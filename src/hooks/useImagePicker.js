import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { compressImage } from '../../utils/imageCompression';
import { useDialog } from '../contexts/Dialog';

/**
 * Hook som kapslar in bildval (galleri/kamera) + komprimering + EXIF-strippning.
 * Returnerar { pickFromGallery, pickFromCamera, loading }
 *
 * @param {object} options - { quality: 0.75, allowsEditing: true, aspect: [4,3] }
 * Callback onPick(compressedUri) anropas med den komprimerade URI:n.
 */
export function useImagePicker(options = {}) {
  const [loading, setLoading] = useState(false);
  const dialog = useDialog();
  const quality = options.quality || 0.75;
  const allowsEditing = options.allowsEditing ?? true;
  const aspect = options.aspect || undefined;

  const pickFromGallery = async (onPick) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      await dialog.alert({
        title: 'Åtkomst nekad',
        message: 'Du måste ge appen tillåtelse att komma åt dina foton.',
      });
      return;
    }
    setLoading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing,
        aspect,
        quality,
      });
      if (!result.canceled) {
        const compressed = await compressImage(result.assets[0].uri, { quality });
        onPick(compressed);
      }
    } finally {
      setLoading(false);
    }
  };

  const pickFromCamera = async (onPick) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      await dialog.alert({
        title: 'Åtkomst nekad',
        message: 'Du måste ge appen tillåtelse att använda kameran.',
      });
      return;
    }
    setLoading(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing,
        aspect,
        quality,
      });
      if (!result.canceled) {
        const compressed = await compressImage(result.assets[0].uri, { quality });
        onPick(compressed);
      }
    } finally {
      setLoading(false);
    }
  };

  return { pickFromGallery, pickFromCamera, loading };
}
