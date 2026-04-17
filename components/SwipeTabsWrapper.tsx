import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { useRouter, usePathname } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

const TAB_ROUTES = [
  '/',
  '/history',
  '/wardrobe',
  '/profile',
] as const;

/** Minimum horizontal travel (px) to trigger a tab switch */
const SWIPE_THRESHOLD_PX = 60;
/** Minimum velocity (px/s) to trigger a tab switch even on short travel */
const SWIPE_THRESHOLD_VX = 400;

interface Props {
  children: ReactNode;
}

export default function SwipeTabsWrapper({ children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme } = useTheme();
  const translateX = useSharedValue(0);

  const currentIndex = TAB_ROUTES.findIndex((route) =>
    route === '/' ? pathname === '/' || pathname === '/index' : pathname === route,
  );
  const numTabs = TAB_ROUTES.length;

  // Runs on JS thread: reset translateX then navigate
  function doNavigate(direction: 'left' | 'right') {
    translateX.value = 0;
    if (direction === 'left' && currentIndex < numTabs - 1) {
      router.push(TAB_ROUTES[currentIndex + 1] as string);
    } else if (direction === 'right' && currentIndex > 0) {
      router.push(TAB_ROUTES[currentIndex - 1] as string);
    }
  }

  const pan = Gesture.Pan()
    // Only activate after clear horizontal intent
    .activeOffsetX([-20, 20])
    // Fail if the user is clearly scrolling vertically
    .failOffsetY([-15, 15])
    .onUpdate((e) => {
      const atLeftEdge = currentIndex === 0 && e.translationX > 0;
      const atRightEdge = currentIndex === numTabs - 1 && e.translationX < 0;
      // Rubber-band at the edges so the gesture still feels responsive
      translateX.value = (atLeftEdge || atRightEdge)
        ? e.translationX * 0.12
        : e.translationX;
    })
    .onEnd((e) => {
      const goLeft =
        currentIndex < numTabs - 1 &&
        (e.translationX < -SWIPE_THRESHOLD_PX || e.velocityX < -SWIPE_THRESHOLD_VX);
      const goRight =
        currentIndex > 0 &&
        (e.translationX > SWIPE_THRESHOLD_PX || e.velocityX > SWIPE_THRESHOLD_VX);

      if (goLeft || goRight) {
        // Reset position immediately — the new screen will appear via navigation
        translateX.value = withTiming(0, { duration: 120, easing: Easing.out(Easing.quad) });
        runOnJS(doNavigate)(goLeft ? 'left' : 'right');
      } else {
        // Not enough — snap back with a spring
        translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={styles.fill}>
      {/* Backdrop — fills the space revealed when the screen slides */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: theme.background }]} />
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.fill, animatedStyle]}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
