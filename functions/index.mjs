import {
  onDocumentCreated,
  onDocumentWritten,
  onDocumentUpdated,
  onDocumentDeleted
} from "firebase-functions/v2/firestore";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { logger } from "firebase-functions";

// 1. Initiera Admin SDK
initializeApp();
const db = getFirestore();

/**
 * Rate limiting helper.
 * Kontrollerar om en användare har överskridit maxantal åtgärder inom en tidsperiod.
 * @param {string} userId
 * @param {string} action - t.ex. 'checkin', 'comment'
 * @param {number} maxActions - max antal per period
 * @param {number} periodMs - tidsperiod i millisekunder (default 1 timme)
 * @returns {Promise<boolean>} true om begränsningen är överskriden
 */
async function isRateLimited(userId, action, maxActions = 10, periodMs = 3600000) {
  const cutoff = new Date(Date.now() - periodMs);
  const rateLimitRef = db.collection('_rateLimits').doc(`${userId}_${action}`);
  const doc = await rateLimitRef.get();

  if (doc.exists) {
    const data = doc.data();
    // Filtrera bort gamla timestamps
    const recentActions = (data.timestamps || []).filter(t => t.toDate() > cutoff);
    if (recentActions.length >= maxActions) {
      logger.warn(`Rate limit: ${userId} har nått max ${maxActions} ${action} per timme`);
      return true;
    }
    // OBS: serverTimestamp() går inte att använda inuti en array i Firestore.
    // Använd Timestamp.now() (funktionens serverklocka) istället.
    await rateLimitRef.update({ timestamps: [...recentActions, Timestamp.now()] });
  } else {
    await rateLimitRef.set({ timestamps: [Timestamp.now()] });
  }
  return false;
}

/**
 * FUNKTION 1: Uppdatera statistik vid incheckning
 * Triggas när ett nytt dokument skapas i "incheckningar"
 */
export const updateUserAndPlaygroundStats = onDocumentCreated(
  "incheckningar/{checkinId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return null;

    const data = snap.data();
    const { lekplatsId, userId, betyg } = data;

    // Validering: Avbryt om viktiga ID:n saknas
    if (!lekplatsId || !userId) {
      logger.warn(`Avbryter: Saknar data för checkin ${event.params.checkinId}`);
      return null;
    }

    // Rate limiting: max 20 incheckningar per timme per användare
    if (await isRateLimited(userId, 'checkin', 20)) {
      logger.warn(`Rate limit nådd för checkin av ${userId}`);
      return null;
    }

    // Hantera betyg (konvertera sträng till nummer om det behövs)
    const numericBetyg = typeof betyg === "number" ? betyg : parseFloat(betyg || 0);
    const validBetyg = isNaN(numericBetyg) ? 0 : numericBetyg;

    const playgroundRef = db.collection("lekplatser").doc(lekplatsId);
    const userRef = db.collection("users").doc(userId);
    const processedRef = db.collection("_processedEvents").doc(event.id);

    try {
      await db.runTransaction(async (tx) => {
        // Idempotens-check (v2 levererar "at least once")
        const processedSnap = await tx.get(processedRef);
        if (processedSnap.exists) return;

        const pgSnap = await tx.get(playgroundRef);
        const pgData = pgSnap.exists ? pgSnap.data() : {};

        const oldTotalCheckins = pgData.antalIncheckningar || 0;
        const oldTotalBetygSum = pgData.totalBetygSum || 0;

        const newTotalCheckins = oldTotalCheckins + 1;
        const newTotalBetygSum = oldTotalBetygSum + validBetyg;
        const newAverage = newTotalCheckins > 0 ? (newTotalBetygSum / newTotalCheckins) : 0;

        // Uppdatera lekplats
        tx.set(playgroundRef, {
          antalIncheckningar: newTotalCheckins,
          totalBetygSum: newTotalBetygSum,
          snittbetyg: Number(newAverage.toFixed(2)),
        }, { merge: true });

        // Uppdatera användare
        tx.set(userRef, {
          totalCheckinCount: FieldValue.increment(1),
          visitedPlaygroundIds: FieldValue.arrayUnion(lekplatsId)
        }, { merge: true });

        // Spara klarade utmaningar per lekplats
        const klarade = Array.isArray(data.klaradeUtmaningar) ? data.klaradeUtmaningar : [];
        if (klarade.length > 0) {
          const completedRef = db.collection("users").doc(userId)
            .collection("klaradeUtmaningar").doc(lekplatsId);
          
          // Hämta redan klarade för att räkna nya unika
          const completedSnap = await tx.get(completedRef);
          const alreadyCompleted = completedSnap.exists ? (completedSnap.data().utmaningar || []) : [];
          const newUnique = klarade.filter(u => !alreadyCompleted.includes(u));

          tx.set(completedRef, {
            utmaningar: FieldValue.arrayUnion(...klarade),
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });

          // Öka totalCompletedChallenges med antalet NYA unika utmaningar
          if (newUnique.length > 0) {
            tx.set(userRef, {
              totalCompletedChallenges: FieldValue.increment(newUnique.length),
            }, { merge: true });
          }
        }

        // Markera event som processat
        tx.set(processedRef, { processedAt: FieldValue.serverTimestamp() });
      });

      logger.info(`✅ Statistik klar för lekplats: ${lekplatsId}`);
    } catch (error) {
      logger.error("❌ Fel i updateUserAndPlaygroundStats:", error);
    }
    return null;
  }
);


/**
 * FUNKTION 1b: Städa upp när en incheckning raderas
 *
 * Firestore kaskadraderar inte: utan den här funktionen skulle en radering
 * lämna lekplatsens snittbetyg och antalIncheckningar för högt, användarens
 * totalCheckinCount fel, kommentarerna kvar som föräldralösa dokument och
 * bilden kvar i Storage.
 *
 * OBS: klarade utmaningar och redan upplåsta troféer rullas INTE tillbaka.
 * Samma utmaning kan vara klarad via flera incheckningar, och en trofé som
 * tagits bort i efterhand är en sämre användarupplevelse än en som står kvar.
 */
export const onCheckinDeleted = onDocumentDeleted(
  "incheckningar/{checkinId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return null;

    const data = snap.data();
    const { lekplatsId, userId, betyg } = data;
    const checkinId = event.params.checkinId;

    const numericBetyg = typeof betyg === "number" ? betyg : parseFloat(betyg || 0);
    const validBetyg = isNaN(numericBetyg) ? 0 : numericBetyg;

    // 1. Rulla tillbaka statistiken
    if (lekplatsId && userId) {
      const playgroundRef = db.collection("lekplatser").doc(lekplatsId);
      const userRef = db.collection("users").doc(userId);
      const processedRef = db.collection("_processedEvents").doc(event.id);

      try {
        await db.runTransaction(async (tx) => {
          // Idempotens – v2 levererar "at least once"
          const processedSnap = await tx.get(processedRef);
          if (processedSnap.exists) return;

          const [pgSnap, userSnap] = await Promise.all([
            tx.get(playgroundRef),
            tx.get(userRef),
          ]);

          if (pgSnap.exists) {
            const pgData = pgSnap.data();
            // Math.max skyddar mot att gamla incheckningar från innan
            // räknarna fanns drar siffrorna under noll.
            const newTotalCheckins = Math.max(0, (pgData.antalIncheckningar || 0) - 1);
            const newTotalBetygSum = Math.max(0, (pgData.totalBetygSum || 0) - validBetyg);
            const newAverage = newTotalCheckins > 0 ? (newTotalBetygSum / newTotalCheckins) : 0;

            tx.set(playgroundRef, {
              antalIncheckningar: newTotalCheckins,
              totalBetygSum: newTotalBetygSum,
              snittbetyg: Number(newAverage.toFixed(2)),
            }, { merge: true });
          }

          if (userSnap.exists) {
            const newCount = Math.max(0, (userSnap.data().totalCheckinCount || 0) - 1);
            tx.set(userRef, { totalCheckinCount: newCount }, { merge: true });
          }

          tx.set(processedRef, { processedAt: FieldValue.serverTimestamp() });
        });
      } catch (error) {
        logger.error(`❌ Kunde inte rulla tillbaka statistik för ${checkinId}:`, error);
      }

      // 2. Ta bort lekplatsen ur besökslistan om det var sista incheckningen där.
      //    Görs utanför transaktionen: dokumentet är redan borta, så frågan
      //    speglar läget efter raderingen.
      try {
        const kvar = await db.collection("incheckningar")
          .where("userId", "==", userId)
          .where("lekplatsId", "==", lekplatsId)
          .limit(1)
          .get();

        if (kvar.empty) {
          await db.collection("users").doc(userId).set({
            visitedPlaygroundIds: FieldValue.arrayRemove(lekplatsId),
          }, { merge: true });
        }
      } catch (error) {
        logger.error(`❌ Kunde inte uppdatera visitedPlaygroundIds för ${userId}:`, error);
      }
    }

    // 3. Radera kommentarerna. Underkollektioner överlever sitt föräldradokument.
    try {
      await db.recursiveDelete(db.collection("incheckningar").doc(checkinId));
    } catch (error) {
      logger.error(`❌ Kunde inte radera kommentarer för ${checkinId}:`, error);
    }

    // 4. Radera incheckningsbilden ur Storage
    if (userId) {
      try {
        await getStorage().bucket().deleteFiles({
          prefix: `images/checkins/${userId}/${checkinId}/`,
        });
      } catch (error) {
        logger.error(`❌ Kunde inte radera bilder för ${checkinId}:`, error);
      }
    }

    logger.info(`🧹 Städning klar efter raderad incheckning ${checkinId}`);
    return null;
  }
);


/* -------------------------------------------------------------------------- */
/* Anonymisering vid kontoradering                                            */
/* -------------------------------------------------------------------------- */

/**
 * Värdena speglar utils/anonymization.js i appen. De kan inte importeras
 * därifrån — functions/ deployas som ett eget paket och ser inte appens filer.
 * Ändras de på ena stället måste de ändras på det andra.
 */
const ANONYMIZED_USER_ID = "anonymiserad";
const ANONYMIZED_DISPLAY_NAME = "Borttagen användare";

/** Plockar ut lagringssökvägen ur en Firebase-nedladdnings-URL. */
function storagePathFromDownloadUrl(url) {
  if (!url || typeof url !== "string") return null;
  if (!url.startsWith("https://firebasestorage.googleapis.com/")) return null;
  const start = url.indexOf("/o/");
  if (start === -1) return null;
  const encoded = url.slice(start + 3).split("?")[0];
  if (!encoded) return null;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}

/**
 * Gamla schemat hade UID i sökvägen: images/checkins/{uid}/{checkinId}/{fil}
 * (fem segment). Nya har fyra och innehåller inget UID.
 */
function isLegacyCheckinImagePath(path) {
  if (!path || !path.startsWith("images/checkins/")) return false;
  return path.split("/").length === 5;
}

/** Commitar uppdateringar i portioner – en batch rymmer 500 skrivningar. */
async function commitInChunks(docs, applyTo, chunkSize = 400) {
  for (let i = 0; i < docs.length; i += chunkSize) {
    const batch = db.batch();
    for (const d of docs.slice(i, i + chunkSize)) applyTo(batch, d);
    await batch.commit();
  }
}

/**
 * Anonymiserar allt innehåll som pekar på en användare när kontot raderas.
 *
 * Incheckningarna ligger kvar med flit — de bär betyg och foton som andra har
 * nytta av, och de kan vara kommenterade. Det som försvinner är kopplingen
 * till personen. Ett kvarvarande UID räknas som personuppgift, så det räcker
 * inte att bara byta ut smeknamnet.
 */
export const anonymizeDeletedUser = onDocumentDeleted(
  "users/{userId}",
  async (event) => {
    const userId = event.params.userId;
    const bucket = getStorage().bucket();

    // 1. Personens egna incheckningar
    try {
      const egna = await db.collection("incheckningar")
        .where("userId", "==", userId).get();

      await commitInChunks(egna.docs, (batch, d) => {
        const uppdatering = {
          userId: ANONYMIZED_USER_ID,
          userSmeknamn: ANONYMIZED_DISPLAY_NAME,
        };
        // Bilder på det gamla schemat har UID:t i sin publika URL och måste bort.
        // Nya bilder ligger på en neutral sökväg och kan vara kvar.
        const path = storagePathFromDownloadUrl(d.data().bildUrl);
        if (isLegacyCheckinImagePath(path)) uppdatering.bildUrl = "";
        batch.update(d.ref, uppdatering);
      });

      logger.info(`Anonymiserade ${egna.size} egna incheckningar för ${userId}`);
    } catch (error) {
      logger.error(`❌ Kunde inte anonymisera egna incheckningar för ${userId}:`, error);
    }

    // 2. Taggningar i ANDRAS incheckningar
    try {
      const taggade = await db.collection("incheckningar")
        .where("taggadeVanner", "array-contains", userId).get();

      await commitInChunks(taggade.docs, (batch, d) => {
        batch.update(d.ref, { taggadeVanner: FieldValue.arrayRemove(userId) });
      });

      logger.info(`Tog bort ${taggade.size} taggningar för ${userId}`);
    } catch (error) {
      logger.error(`❌ Kunde inte ta bort taggningar för ${userId}:`, error);
    }

    // 3. Likes i andras incheckningar
    try {
      const likeade = await db.collection("incheckningar")
        .where("likes", "array-contains", userId).get();

      await commitInChunks(likeade.docs, (batch, d) => {
        batch.update(d.ref, { likes: FieldValue.arrayRemove(userId) });
      });

      logger.info(`Tog bort ${likeade.size} likes för ${userId}`);
    } catch (error) {
      logger.error(`❌ Kunde inte ta bort likes för ${userId}:`, error);
    }

    // 4. Kommentarer personen skrivit, var de än ligger
    try {
      const kommentarer = await db.collectionGroup("comments")
        .where("userId", "==", userId).get();

      await commitInChunks(kommentarer.docs, (batch, d) => {
        batch.update(d.ref, { userId: ANONYMIZED_USER_ID });
      });

      logger.info(`Anonymiserade ${kommentarer.size} kommentarer för ${userId}`);
    } catch (error) {
      logger.error(`❌ Kunde inte anonymisera kommentarer för ${userId}:`, error);
    }

    // 5. Vänlistor hos andra användare
    try {
      const vanner = await db.collection("users")
        .where("friends", "array-contains", userId).get();

      await commitInChunks(vanner.docs, (batch, d) => {
        batch.update(d.ref, { friends: FieldValue.arrayRemove(userId) });
      });

      logger.info(`Tog bort ${userId} ur ${vanner.size} vänlistor`);
    } catch (error) {
      logger.error(`❌ Kunde inte städa vänlistor för ${userId}:`, error);
    }

    // 6. Bilder: gamla incheckningsbilder med UID i sökvägen, samt profilbilden
    try {
      await bucket.deleteFiles({ prefix: `images/checkins/${userId}/` });
      await bucket.file(`profilbilder/${userId}`).delete({ ignoreNotFound: true });
    } catch (error) {
      logger.error(`❌ Kunde inte radera bilder för ${userId}:`, error);
    }

    logger.info(`🧹 Anonymisering klar för ${userId}`);
    return null;
  }
);


/**
 * FUNKTION 2: Räknar kommentarer och skickar notis
 * Triggas vid alla ändringar i underkollektionen "comments"
 */
export const updateCommentCount = onDocumentWritten(
  "incheckningar/{checkinId}/comments/{commentId}", 
  async (event) => {
    const { checkinId } = event.params;
    const checkinRef = db.collection("incheckningar").doc(checkinId);

    // 1. Räkna alla kommentarer i underkollektionen
    const commentsSnapshot = await checkinRef.collection("comments").get();
    const commentCount = commentsSnapshot.size;
    const updatePromise = checkinRef.update({ commentCount });

    // 2. Notis-logik (Endast vid NY kommentar)
    const isNewComment = !event.data.before.exists && event.data.after.exists;
    if (!isNewComment) return updatePromise;

    try {
      const commentData = event.data.after.data();
      const commentAuthorId = commentData.userId;
      const commentAuthorName = commentData.userName || "Någon";
      const commentText = commentData.text || '';

      if (!commentAuthorId) return updatePromise;

      const checkinDoc = await checkinRef.get();
      if (!checkinDoc.exists) return updatePromise;

      const checkinOwnerId = checkinDoc.data().userId;

      // notify checkin owner if it's a new comment by somebody else
      const jobs = [];
      if (commentAuthorId !== checkinOwnerId) {
        const notificationRef = db.collection("users").doc(checkinOwnerId).collection("notifications").doc();
        jobs.push(notificationRef.set({
          type: "COMMENT",
          title: "Ny kommentar!",
          message: `${commentAuthorName} kommenterade din incheckning.`,
          read: false,
          createdAt: FieldValue.serverTimestamp(),
          link: `/incheckning/${checkinId}`
        }));
      }

      // check for @mentions in text (max 5 unika mentions per kommentar)
      const MAX_MENTIONS = 5;
      const mentionRegex = /@([\wåäöÅÄÖ0-9_-]+)/g;
      const mentioned = new Set();
      let m;
      while ((m = mentionRegex.exec(commentText)) !== null) {
        mentioned.add(m[1]);
        if (mentioned.size >= MAX_MENTIONS) break;
      }
      if (mentioned.size > 0) {
        // fetch corresponding users by nickname
        const mentionPromises = [...mentioned].map(name =>
          db.collection('users').where('smeknamn','==',name).limit(1).get()
        );
        const mentionSnaps = await Promise.all(mentionPromises);
        mentionSnaps.forEach(snap => {
          if (!snap.empty) {
            const userDoc = snap.docs[0];
            const mentionedUid = userDoc.id;
            if (mentionedUid !== commentAuthorId && mentionedUid !== checkinOwnerId) {
              const notifRef2 = db.collection("users").doc(mentionedUid).collection("notifications").doc();
              jobs.push(notifRef2.set({
                type: "MENTION",
                title: "Du blev nämnd!",
                message: `${commentAuthorName} nämnde dig i en kommentar.`,
                read: false,
                createdAt: FieldValue.serverTimestamp(),
                link: `/incheckning/${checkinId}`
              }));
            }
          }
        });
      }

      if (jobs.length > 0) {
        return Promise.all([updatePromise, ...jobs]);
      }
      return updatePromise;
    } catch (e) {
      logger.error("Fel vid kommentarsnotis:", e);
      return updatePromise;
    }
  }
);

// ---------- PUSH NOTIFICATION HELPERS & TRIGGERS ----------

// skickar Expo push via HTTP
async function sendExpoPush(expoToken, message) {
  if (!expoToken) return;
  const body = {
    to: expoToken,
    sound: 'default',
    title: message.title,
    body: message.body,
    data: message.data || {},
  };
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (json.data?.status === 'error') {
      logger.error('Expo push FEL:', json.data.message, json.data.details);
    } else {
      logger.info('Skickade Expo-push', expoToken, message);
    }
  } catch (e) {
    logger.error('Push-sändning misslyckades', e);
  }
}

// trigger vid like-uppdatering
export const onCheckinLike = onDocumentUpdated(
  'incheckningar/{checkinId}',
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    const newLikes = after.likes || [];
    const oldLikes = before.likes || [];
    if (newLikes.length <= oldLikes.length) return null;

    const likerId = newLikes.find((id) => !oldLikes.includes(id));
    if (!likerId) return null;
    if (likerId === after.userId) return null;

    const ownerDoc = await db.collection('users').doc(after.userId).get();
    const expoToken = ownerDoc.data()?.expoPushToken;
    const likerDoc = await db.collection('users').doc(likerId).get();
    const likerName = likerDoc.data()?.smeknamn || 'Någon';

    return sendExpoPush(expoToken, {
      title: 'Någon gillar din incheckning',
      body: `${likerName} gav en ⭐`,
      data: { type: 'like', checkinId: event.params.checkinId },
    });
  }
);

// onCheckinComment borttagen — updateCommentCount + sendPushOnNotification hanterar redan kommentarsnotiser

/**
 * FUNKTION 3: Skicka push-notifikation när en notis skapas
 * Triggas när ett nytt dokument skapas i "users/{userId}/notifications"
 */
export const sendPushOnNotification = onDocumentCreated(
  "users/{userId}/notifications/{notificationId}",
  async (event) => {
    const userId = event.params.userId;
    const notificationData = event.data.data();
    
    // Hämta användarens push-token
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) return null;
    
    const expoPushToken = userDoc.data()?.expoPushToken;
    if (!expoPushToken) {
      logger.info(`Ingen push-token för användare ${userId}`);
      return null;
    }
    
    // Skicka push-notifikation
    const message = {
      title: notificationData.title || 'Ny notis',
      body: notificationData.message || '',
      data: {
        type: notificationData.type || 'notification',
        link: notificationData.link || '',
      },
    };
    
    logger.info(`Skickar push till ${userId}: ${message.title}`);
    return sendExpoPush(expoPushToken, message);
  }
);

/**
 * FUNKTION 4: Trofé-system
 * Triggas när ett användardokument uppdateras (t.ex. när checkinCount ökar)
 */
export const checkTrophies = onDocumentUpdated("users/{userId}", async (event) => {
  const userData = event.data.after.data();
  const userId = event.params.userId;

  // Hämta redan upplåsta troféer
  const unlockedSnapshot = await db.collection("users").doc(userId).collection("unlockedTrophies").get();
  const unlockedMap = {};
  unlockedSnapshot.forEach(doc => { unlockedMap[doc.id] = doc.data(); });

  // Hämta trofé-katalogen
  const trophiesSnapshot = await db.collection("trophies").get();
  const batch = db.batch();
  let trophiesChanged = 0;
  // Håller reda på vilket level-value som sätts för varje trofé i detta batch
  const effectiveLevelValues = {};

  trophiesSnapshot.forEach(trophyDoc => {
    const trophy = trophyDoc.data();
    const trophyId = trophyDoc.id;
    const statToTrack = trophy.statToTrack;

    if (!statToTrack) return;

    const userStatData = userData[statToTrack];
    let userStatValue = 0;

    // Omvandla statistik till siffra för jämförelse
    if (typeof userStatData === 'number') {
      userStatValue = userStatData;
    } else if (Array.isArray(userStatData)) {
      userStatValue = userStatData.length;
    } else if (statToTrack === "profilbildUrl" && userStatData) {
      userStatValue = 1;
    }

    // Hitta högsta uppnådda nivå
    let newLevelData = null;
    if (trophy.levels && Array.isArray(trophy.levels)) {
      for (const level of trophy.levels) {
        if (userStatValue >= level.value) {
          newLevelData = level;
        } else {
          break;
        }
      }
    }

    if (!newLevelData) return;

    const currentLevel = unlockedMap[trophyId]?.level || 0;

    // Spara effektivt level-value för räkning nedan (oavsett om det är nytt eller ej)
    effectiveLevelValues[trophyId] = newLevelData.value;

    // Om ny nivå uppnåtts
    if (newLevelData.value > currentLevel) {
      trophiesChanged++;
      const trophyRef = db.doc(`users/${userId}/unlockedTrophies/${trophyId}`);
      const isUpgrade = !!unlockedMap[trophyId];

      const unlockData = {
        level: newLevelData.value,
        title: newLevelData.title,
        trophyTitle: trophy.title,
        unlockedAt: unlockedMap[trophyId]?.unlockedAt || FieldValue.serverTimestamp()
      };
      if (isUpgrade) unlockData.upgradedAt = FieldValue.serverTimestamp();

      batch.set(trophyRef, unlockData, { merge: true });

      // Skapa notis för trofén
      const notifRef = db.collection("users").doc(userId).collection("notifications").doc();
      batch.set(notifRef, {
        type: "TROPHY",
        title: isUpgrade ? "Nivå upp!" : "Ny trofé!",
        message: `Grattis! Du har nått '${newLevelData.title}' för '${trophy.title}'.`,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
        link: "/profile/trophies"
      });
    }
  });

  if (trophiesChanged > 0) {
    // Räkna totalt antal uppnådda nivåer — varje nivå räknas som en egen trofé.
    // Använd effectiveLevelValues för trofeer som uppdateras nu, annars unlockedMap.
    let totalLevels = 0;
    trophiesSnapshot.forEach(trophyDoc => {
      const trophyId = trophyDoc.id;
      const levels = trophyDoc.data().levels;
      if (!Array.isArray(levels)) return;
      const levelValue = effectiveLevelValues[trophyId] ?? unlockedMap[trophyId]?.level ?? 0;
      if (levelValue === 0) return;
      totalLevels += levels.filter(l => l.value <= levelValue).length;
    });

    const userRef = db.doc(`users/${userId}`);
    batch.update(userRef, { unlockedTrophiesCount: totalLevels });
    logger.info(`Utdelat ${trophiesChanged} troféer till ${userId}, totalt ${totalLevels} nivåer`);
    return batch.commit();
  }
  return null;
});

export const onCheckInCreateSendNotificationToTagged = onDocumentCreated("incheckningar/{checkInId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) {
    logger.log("Inget data, avslutar.");
    return;
  }

  const checkInData = snapshot.data();
  const taggedFriends = checkInData.taggadeVanner; // Array av user IDs

  if (!Array.isArray(taggedFriends) || taggedFriends.length === 0) {
    logger.log("Inga vänner taggade i", event.params.checkInId);
    return;
  }

  logger.log(`Hittade ${taggedFriends.length} taggade vänner. Skapar notiser...`);

  const batch = db.batch();

  taggedFriends.forEach(friendId => {
    // Skapa inte en notis till sig själv om man råkat tagga sig själv
    if (friendId === checkInData.userId) return;

    const notificationRef = db.collection("users").doc(friendId).collection("notifications").doc();
    batch.set(notificationRef, {
      type: "TAG",
      title: "Du blev taggad!",
      message: `${checkInData.userSmeknamn} taggade dig i en incheckning på ${checkInData.lekplatsNamn}.`,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
      link: `/incheckning/${snapshot.id}`,
    });
  });

  try {
    await batch.commit();
    logger.log("Notiser skapade!");
  } catch (error) {
    logger.error("Kunde inte skapa notiser:", error);
  }
});

// ---------- VÄNFÖRFRÅGNINGAR ----------

/**
 * FUNKTION: Notifiera mottagaren när en vänförfrågan skickas
 */
export const onFriendRequestCreated = onDocumentCreated(
  "friendRequests/{requestId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return null;

    const data = snap.data();
    if (data.status !== "pending") return null;

    const { fromUserId, toUserId } = data;
    if (!fromUserId || !toUserId) return null;

    try {
      const fromUserDoc = await db.collection("users").doc(fromUserId).get();
      const smeknamn = fromUserDoc.data()?.smeknamn || "Någon";

      const notifRef = db.collection("users").doc(toUserId).collection("notifications").doc();
      await notifRef.set({
        type: "FRIEND_REQUEST",
        title: "Ny vänförfrågan",
        message: `${smeknamn} vill bli din vän!`,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
        link: "FriendsScreen",
      });

      logger.info(`Vänförfrågan-notis skickad från ${fromUserId} till ${toUserId}`);
    } catch (e) {
      logger.error("Fel vid vänförfrågan-notis:", e);
    }
    return null;
  }
);

/**
 * FUNKTION: Notifiera avsändaren när en vänförfrågan accepteras
 */
export const onFriendRequestAccepted = onDocumentUpdated(
  "friendRequests/{requestId}",
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();

    if (before.status === after.status) return null;
    if (after.status !== "accepted") return null;

    const { fromUserId, toUserId } = after;
    if (!fromUserId || !toUserId) return null;

    try {
      const toUserDoc = await db.collection("users").doc(toUserId).get();
      const smeknamn = toUserDoc.data()?.smeknamn || "Någon";

      const notifRef = db.collection("users").doc(fromUserId).collection("notifications").doc();
      await notifRef.set({
        type: "FRIEND_REQUEST_ACCEPTED",
        title: "Vänförfrågan accepterad!",
        message: `${smeknamn} accepterade din vänförfrågan.`,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
        link: "FriendsScreen",
      });

      logger.info(`Accept-notis skickad till ${fromUserId} (accepterad av ${toUserId})`);
    } catch (e) {
      logger.error("Fel vid accept-notis:", e);
    }
    return null;
  }
);

// ---------- ADMIN-NOTISER VID NY REVIEW-LEKPLATS ----------

/**
 * FUNKTION: Notifiera admins när en lekplats skapas med status "review"
 */
export const notifyAdminsOnReviewPlayground = onDocumentCreated(
  "lekplatser/{lekplatsId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    if (data.status !== "review") return;

    const namn = data.namn || "Okänd lekplats";
    const createdBy = data.createdBy || "";

    try {
      const adminsSnap = await db.collection("users").where("isAdmin", "==", true).get();
      if (adminsSnap.empty) return;

      const batch = db.batch();
      adminsSnap.forEach((adminDoc) => {
        if (adminDoc.id === createdBy) return;
        const notifRef = db.collection("users").doc(adminDoc.id).collection("notifications").doc();
        batch.set(notifRef, {
          type: "ADMIN_REVIEW",
          title: "Ny lekplats att granska",
          message: `"${namn}" har skickats in och väntar på granskning.`,
          read: false,
          createdAt: FieldValue.serverTimestamp(),
          link: `/admin/review`,
        });
      });
      await batch.commit();
      logger.info(`Admin-notiser skickade för ny review-lekplats: ${namn}`);
    } catch (e) {
      logger.error("Fel vid admin-notis (review-lekplats):", e);
    }
  }
);

/**
 * FUNKTION: Notifiera admins när ett ändringsförslag skapas
 */
export const notifyAdminsOnSuggestion = onDocumentCreated(
  "andringsforslag/{forslagId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    const lekplatsNamn = data.lekplatsNamn || "en lekplats";
    const userId = data.userId || "";

    try {
      const adminsSnap = await db.collection("users").where("isAdmin", "==", true).get();
      if (adminsSnap.empty) return;

      const batch = db.batch();
      adminsSnap.forEach((adminDoc) => {
        const notifRef = db.collection("users").doc(adminDoc.id).collection("notifications").doc();
        batch.set(notifRef, {
          type: "ADMIN_SUGGESTION",
          title: "Nytt ändringsförslag",
          message: `Nytt förslag inkommit för "${lekplatsNamn}".`,
          read: false,
          createdAt: FieldValue.serverTimestamp(),
          link: `/admin/review`,
        });
      });
      await batch.commit();
      logger.info(`Admin-notiser skickade för ändringsförslag: ${lekplatsNamn}`);
    } catch (e) {
      logger.error("Fel vid admin-notis (ändringsförslag):", e);
    }
  }
);

// ---------- RAPPORTER ----------

/**
 * FUNKTION: Notifiera admins när en ny rapport skapas
 */
export const notifyAdminsOnReport = onDocumentCreated(
  "rapporter/{rapportId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    const typeLabel = data.type === 'comment' ? 'kommentar' : 'incheckning';

    try {
      const adminsSnap = await db.collection("users").where("isAdmin", "==", true).get();
      if (adminsSnap.empty) return;

      const batch = db.batch();
      adminsSnap.forEach((adminDoc) => {
        const notifRef = db.collection("users").doc(adminDoc.id).collection("notifications").doc();
        batch.set(notifRef, {
          type: "ADMIN_REPORT",
          title: "Ny rapport inkommit",
          message: `En användare har rapporterat en ${typeLabel}: "${data.reason}".`,
          read: false,
          createdAt: FieldValue.serverTimestamp(),
          link: "ManageReports",
        });
      });
      await batch.commit();
      logger.info(`Admin-notiser skickade för ny rapport: ${event.params.rapportId}`);
    } catch (e) {
      logger.error("Fel vid admin-notis (rapport):", e);
    }
  }
);

/**
 * FUNKTION: Notifiera rapportören när rapporten hanteras (granskad eller avvisad)
 */
export const notifyReporterOnReportUpdate = onDocumentUpdated(
  "rapporter/{rapportId}",
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();

    if (before.status === after.status) return null;
    if (after.status !== "reviewed" && after.status !== "dismissed") return null;

    const reportedByUserId = after.reportedByUserId;
    if (!reportedByUserId) return null;

    const isDismissed = after.status === "dismissed";
    const typeLabel = after.type === 'comment' ? 'kommentaren' : 'inlägget';

    try {
      const notifRef = db.collection("users").doc(reportedByUserId).collection("notifications").doc();
      await notifRef.set({
        type: "REPORT_UPDATE",
        title: isDismissed ? "Rapport avvisad" : "Rapport genomförd",
        message: isDismissed
          ? `Din rapport om ${typeLabel} har granskats och avvisats.`
          : `Din rapport om ${typeLabel} har granskats och åtgärdats.`,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
        link: "Notifications",
      });
      logger.info(`Rapportör ${reportedByUserId} notifierad om status: ${after.status}`);
    } catch (e) {
      logger.error("Fel vid notis till rapportör:", e);
    }
    return null;
  }
);

/**
 * FUNKTION: Aggregera sponsor-analytik till totals
 * Triggas när ett dagsdokument i sponsors/{id}/stats/{datum} skrivs.
 * Räknar ut delta mot föregående värde och uppdaterar totalStats på sponsor-dokumentet.
 */
export const aggregateSponsorStats = onDocumentWritten(
  "sponsors/{sponsorId}/stats/{date}",
  async (event) => {
    const sponsorId = event.params.sponsorId;
    const after = event.data.after?.data() || {};
    const before = event.data.before?.data() || {};

    const fields = ["badgeImpressions", "popupOpens", "hittaHitClicks", "websiteClicks"];
    const delta = {};
    for (const field of fields) {
      const diff = (after[field] || 0) - (before[field] || 0);
      if (diff !== 0) {
        delta[`totalStats.${field}`] = FieldValue.increment(diff);
      }
    }

    if (Object.keys(delta).length === 0) return null;

    try {
      await db.collection("sponsors").doc(sponsorId).update(delta);
      logger.info(`Uppdaterade totalStats för sponsor ${sponsorId}`);
    } catch (e) {
      logger.error(`Fel vid aggregering av sponsor-statistik (${sponsorId}):`, e);
    }
    return null;
  }
);