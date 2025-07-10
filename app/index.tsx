import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';

export default function Index() {
  const router = useRouter();
  
  useEffect(() => {
    // Navigate to conversation page
    if (Platform.OS === 'web') {
      // For web, use replace to avoid back button issues
      router.replace('/conversation');
    } else {
      router.push('/conversation');
    }
  }, [router]);
  
  return null;
}