# App Template - Expo React Native

This template provides a complete starting point for building React Native apps with Expo, featuring:

- ✅ Light/Dark theme support with persistent preferences
- ✅ File-based routing with Expo Router
- ✅ TypeScript configuration
- ✅ Reusable themed components
- ✅ Custom alert system
- ✅ Professional UI/UX patterns
- ✅ AsyncStorage integration
- ✅ Cross-platform support (iOS, Android, Web)
- ✅ Website template with Privacy Policy and Terms of Use

## 🚀 Getting Started

1. **Copy this template** to your new project location
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Update app.json** with your app name and details
4. **Update Website/** folder with your app information
5. **Start development**:
   ```bash
   npm start
   ```

## 📁 Project Structure

```
app/
  _layout.tsx          # Root layout with theme provider
  index.tsx            # Home screen
  (tabs)/              # Tab navigation screens
    index.tsx          # Main tab screen
    _layout.tsx        # Tab navigator
constants/
  colors.ts            # Theme color definitions
  theme.ts             # Legacy theme constants (optional)
contexts/
  ThemeContext.tsx     # Theme management context
components/
  CustomAlert.tsx      # Custom alert dialog
  SettingsModal.tsx    # Settings modal template
  themed-text.tsx      # Themed text component
  themed-view.tsx      # Themed view component
services/
  storage.ts           # AsyncStorage utilities
types/
  app.ts               # TypeScript type definitions
Website/
  index.html           # Landing page
  policy.html          # Privacy policy
  terms.html           # Terms of use
```

## 🎨 Design System

Refer to `../DESIGN_SYSTEM.md` for complete style guide including:
- Color palette (light/dark themes)
- Spacing and layout standards
- Typography system
- Component styles
- Animation patterns
- Accessibility guidelines

## 🌐 Website Template

The `Website/` folder contains ready-to-use HTML templates:

### Customization Steps:
1. **Update app name** in all three HTML files
2. **Add your app icon** as `icon.png` in the Website folder
3. **Update contact information** in policy.html and terms.html
4. **Update effective dates** for legal documents
5. **Modify pricing** if different from €4.99
6. **Add App Store/Play Store links** when available
7. **Host on GitHub Pages, Netlify, or Vercel**

The website includes:
- Responsive design for mobile and desktop
- Clean, professional styling
- App Store badge ready
- SEO-friendly structure

## 🎨 App Customization

### 1. Update Colors
Edit `constants/colors.ts` to change your brand colors:
```typescript
export const lightTheme = {
  primary: '#YOUR_PRIMARY_COLOR',
  secondary: '#YOUR_SECONDARY_COLOR',
  // ...
};
```

### 2. Add New Screens
Create new files in the `app/` folder:
```typescript
// app/about.tsx
import { useTheme } from '@/contexts/ThemeContext';
import { View, Text, StyleSheet } from 'react-native';

export default function AboutScreen() {
  const { theme } = useTheme();
  
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.text, { color: theme.text }]}>About Screen</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  text: { fontSize: 18 },
});
```

### 3. Add New Components
Create reusable components in `components/`:
```typescript
// components/CustomButton.tsx
import { useTheme } from '@/contexts/ThemeContext';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';

interface CustomButtonProps {
  title: string;
  onPress: () => void;
}

export default function CustomButton({ title, onPress }: CustomButtonProps) {
  const { theme } = useTheme();
  
  return (
    <TouchableOpacity 
      style={[styles.button, { backgroundColor: theme.primary }]}
      onPress={onPress}
    >
      <Text style={[styles.text, { color: theme.buttonText }]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  text: {
    fontSize: 18,
    fontWeight: '600',
  },
});
```

## 📱 Features Included

### Theme System
- Light and dark mode support
- Persistent theme preference
- Easy color customization
- Automatic color switching

### Navigation
- File-based routing with Expo Router
- Tab navigation template
- Stack navigation support

### Storage
- AsyncStorage utilities
- Type-safe storage functions
- Easy data persistence

### UI Components
- Custom alert dialog
- Settings modal
- Themed components
- Reusable patterns

### Website
- Landing page with app showcase
- Privacy policy template
- Terms of use template
- Responsive design

## 🛠️ Available Scripts

- `npm start` - Start Expo development server
- `npm run ios` - Start on iOS simulator
- `npm run android` - Start on Android emulator
- `npm run web` - Start web version
- `npm run lint` - Run ESLint

## 📚 Dependencies

Core dependencies included:
- Expo SDK ~54.0
- React 19.1.0
- React Native 0.81.5
- Expo Router ~6.0
- AsyncStorage
- TypeScript

See `package.json` for complete list.

## 🎯 Next Steps

1. Remove this README or update it for your app
2. Update app.json with your app details (bundle ID, app name, etc.)
3. Customize colors in constants/colors.ts
4. Update Website folder with your app information
5. Add your app icon (1024x1024px) to assets/ and Website/
6. Add your app-specific screens and logic
7. Update legal documents with your information
8. Refer to DESIGN_SYSTEM.md for style guidelines
9. Deploy website to hosting service
10. Submit app to App Store/Play Store

## 📖 Documentation

- [Expo Documentation](https://docs.expo.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [React Native](https://reactnative.dev/)
- [Design System Guide](../DESIGN_SYSTEM.md)

## 🌐 Deploying Your Website

### GitHub Pages
1. Push Website folder to GitHub
2. Enable GitHub Pages in repository settings
3. Select branch and /Website folder

### Netlify
1. Connect repository
2. Set build folder to `Website`
3. Deploy

### Vercel
1. Import repository
2. Set output directory to `Website`
3. Deploy

Happy coding! 🚀
