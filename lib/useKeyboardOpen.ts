import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

// Klavye açık mı? Sahadan ekranında alt navbar'ı klavye açıkken gizlemek için kullanılır.
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setOpen(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setOpen(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return open;
}
