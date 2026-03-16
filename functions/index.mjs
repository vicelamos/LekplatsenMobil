import { 
  onDocumentCreated, 
  onDocumentWritten, 
  onDocumentUpdated 
} from "firebase-functions/v2/firestore";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";

// 1. Initiera Admin SDK
initializeApp();
const db = getFirestore();

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

      // check for @mentions in text
      const mentionRegex = /@([\wåäöÅÄÖ0-9_-]+)/g;
      const mentioned = new Set();
      let m;
      while ((m = mentionRegex.exec(commentText)) !== null) {
        mentioned.add(m[1]);
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
    logger.info(`Utdelat ${trophiesChanged} troféer till ${userId}`);
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