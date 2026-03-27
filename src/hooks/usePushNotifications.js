import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';

const EAS_PROJECT_ID = 'ea779f71-c184-4011-b809-4514ebcda658';

// Konfigurerar hur notifieringar visas när appen är i förgrunden
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerPushToken(uid) {
  try {
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') {
      console.log('Push-notifieringstillstånd nekades');
      return;
    }

    const token = (await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID })).data;

    await setDoc(doc(db, 'users', uid), { expoPushToken: token }, { merge: true });

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4CAF50',
      });
    }
  } catch (e) {
    console.warn('Kunde inte registrera push-token:', e);
  }
}

export function usePushNotifications(navigationRef) {
  useEffect(() => {
    const receivedSub = Notifications.addNotificationReceivedListener(() => {
      // Notifikationen visas automatiskt tack vare setNotificationHandler ovan
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;

      if (data?.type === 'like' || data?.type === 'comment') {
        if (data.checkinId) {
          navigationRef.current?.navigate('Comments', { checkInId: data.checkinId, checkInComment: '' });
        }
      } else if (data?.type === 'TROPHY') {
        navigationRef.current?.navigate('Trophies');
      } else if (data?.type === 'COMMENT' || data?.type === 'MENTION') {
        const checkinMatch = (data.link || '').match(/\/incheckning\/(.+)/);
        if (checkinMatch) {
          navigationRef.current?.navigate('Comments', { checkInId: checkinMatch[1], checkInComment: '' });
        }
      }
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [navigationRef]);
}
