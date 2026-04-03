# Website Template - App Landing Page

This template provides a modern, purple gradient design for app landing pages with privacy policy and terms of use.

## Files Included
- `index.html` - Main landing page
- `policy.html` - Privacy Policy page
- `terms.html` - Terms of Use page

## How to Use

Replace all placeholders (marked with `{{PLACEHOLDER_NAME}}`) with your app-specific information.

### Index.html Placeholders

| Placeholder | Description | Example |
|------------|-------------|---------|
| `{{APP_NAME}}` | Your app name | "LearnIntel" |
| `{{APP_SUBTITLE}}` | Brief app category/type | "AI Learning App" |
| `{{APP_DESCRIPTION}}` | Short description for meta tag | "Your AI-powered companion for smarter, personalized learning." |
| `{{APP_TAGLINE}}` | Hero section tagline | "AI-Powered Personalized Learning" |
| `{{APP_STORE_LINK}}` | Full App Store URL | "https://apps.apple.com/us/app/learnintel/id6754045333" |
| `{{LOCALE}}` | App Store badge locale | "en-us" or "de-de" |
| `{{PRICE}}` | Display price with currency | "€4.99" or "€10" |
| `{{MAIN_HEADING}}` | Main content heading | "Learn Smarter, Not Harder" |
| `{{MAIN_DESCRIPTION}}` | Main content paragraph | Your full description text |
| `{{YEAR}}` | Copyright year | "2026" |

#### Feature Placeholders (6 features)
For each feature (1-6), replace:
- `{{FEATURE_X_ICON}}` - Emoji or icon (e.g., "🤖", "📚", "🎯")
- `{{FEATURE_X_TITLE}}` - Feature title (e.g., "AI Course Generation")
- `{{FEATURE_X_DESCRIPTION}}` - Feature description

### Policy.html Placeholders

| Placeholder | Description | Example |
|------------|-------------|---------|
| `{{APP_NAME}}` | Your app name | "LearnIntel" |
| `{{APP_SUBTITLE}}` | Brief app category/type | "AI Learning App" |
| `{{EFFECTIVE_DATE}}` | Policy effective date | "January 17, 2026" |
| `{{APP_SERVICE_TYPE}}` | Type of service | "AI-powered learning" |
| `{{APP_EXPERIENCE}}` | User experience type | "learning" or "quiz" |
| `{{PRICE_NUMBER}}` | Price number only | "10 EUR" or "4.99 EUR" |
| `{{APP_CORE_FEATURES}}` | Core feature description | "AI course generation" |
| `{{PURCHASE_GUARANTEE_SECTION}}` | Optional: " and Generation Guarantee" or leave empty |
| `{{GUARANTEE_LIST_ITEM}}` | Optional: Add guarantee item or leave empty |
| `{{USER_RIGHTS_ADDITIONAL}}` | Optional: Add extra user rights or leave empty |
| `{{POLICY_CHANGE_ADDITIONAL}}` | Optional: Add additional change items or leave empty |
| `{{CONTACT_EMAIL}}` | Support email | "mail@ahmousavi.com" |
| `{{CONTACT_ADDRESS}}` | Business address | "Hauptstr. 4, 61276 Weilrod, Germany" |
| `{{CONTACT_PHONE}}` | Contact phone | "+49 15753674255" |
| `{{YEAR}}` | Copyright year | "2026" |

### Terms.html Placeholders

| Placeholder | Description | Example |
|------------|-------------|---------|
| `{{APP_NAME}}` | Your app name | "LearnIntel" |
| `{{APP_SUBTITLE}}` | Brief app category/type | "AI Learning App" |
| `{{EFFECTIVE_DATE}}` | Terms effective date | "January 17, 2026" |
| `{{PRICE_NUMBER}}` | Price number only | "10 EUR" |
| `{{APP_CORE_FEATURES}}` | Core feature description | "AI learning and course generation" |
| `{{GUARANTEE_LIST_ITEM}}` | Optional: Add guarantee list item or leave empty |
| `{{GUARANTEE_SECTION}}` | Optional: Full guarantee section HTML or leave empty |
| `{{LIFETIME_ACCESS_SECTION}}` | Optional: Full lifetime access section HTML or leave empty |
| `{{AI_CONTENT_SECTION}}` | Optional: AI-generated content section or leave empty |
| `{{PRIVACY_POLICY_LINK}}` | Link to privacy policy | "https://learnintel.ahmousavi.com/policy" |
| `{{EDUCATIONAL_CONTENT_SECTION}}` | Optional: Educational content disclaimer or leave empty |
| `{{GUARANTEE_LIABILITY_SECTION}}` | Optional: Guarantee liability text or leave empty |
| `{{TERMINATION_GUARANTEE_SECTION}}` | Optional: Termination guarantee text or leave empty |
| `{{TERMS_CHANGE_GUARANTEE_SECTION}}` | Optional: Terms change guarantee text or leave empty |
| `{{JURISDICTION}}` | Governing law jurisdiction | "the European Union and Germany" |
| `{{JURISDICTION_COURTS}}` | Court jurisdiction | "German courts for EU users" |
| `{{CONTACT_EMAIL}}` | Support email | "mail@ahmousavi.com" |
| `{{CONTACT_ADDRESS}}` | Business address | "Hauptstr. 4, 61276 Weilrod, Germany" |
| `{{CONTACT_PHONE}}` | Contact phone | "+49 15753674255" |
| `{{CLOSING_MESSAGE}}` | Final thank you message | "We're committed to providing you with the best AI-powered learning experience." |
| `{{YEAR}}` | Copyright year | "2026" |

## Optional Sections

Some placeholders are for optional sections. If your app doesn't need them (e.g., no generation guarantee), simply remove the entire placeholder including any surrounding HTML.

### Example Optional Section Replacements

**For apps WITH generation guarantee:**
```
{{GUARANTEE_LIST_ITEM}} = <li>A <strong>guarantee of at least 30 successful course generations</strong> following your purchase</li>
```

**For apps WITHOUT generation guarantee:**
```
{{GUARANTEE_LIST_ITEM}} = <!-- Leave empty or remove -->
```

## Design Customization

The template uses a purple gradient theme by default:
- Primary color: `#667eea`
- Secondary color: `#764ba2`

To change colors, modify the CSS gradient and accent colors in each file's `<style>` section.

## Files You Need

Don't forget to include:
- `icon.png` - Your app icon (recommended: 512x512px or higher)
- App Store badge is loaded from Apple's CDN automatically

## Contact Information

All contact details default to:
- Email: mail@ahmousavi.com
- Address: Hauptstr. 4, 61276 Weilrod, Germany
- Phone: +49 15753674255

Make sure to update these placeholders if your contact information differs.
