# SheDrive — Design System

## 1. Colours and Theme

Brand direction:
- Premium
- Safe
- Feminine but professional
- Modern
- Calm
- Trustworthy

### Core Palette
```text
Deep Purple       #4A2060
Royal Purple      #6A2C70
Rose Pink         #FF80AB
Soft Rose         #F8D7E3
White             #FFFFFF
Off White         #FAF8FB
Dark Text         #241B26
Secondary Text    #6F6572
Success           #2E8B57
Warning           #D98E04
Error / SOS       #C62828
Border            #E7DDE8
```

Use colour for hierarchy, not decoration everywhere.

## 2. Fonts
Preferred: Inter and Poppins.

Use an already available project font where possible; do not add a dependency merely for decoration.

Recommended:
- Headings: Poppins SemiBold/Bold
- Body: Inter Regular/Medium
- Buttons: Inter SemiBold

## 3. Typography
- Large title: 28–32 px
- Screen title: 22–26 px
- Section title: 18–20 px
- Body: 15–16 px
- Secondary: 13–14 px
- Caption: 11–12 px
- Button: 14–16 px
- Input label: 12–14 px
- Input text: 15–16 px

## Components
Buttons need clear hierarchy, large touch targets, loading/disabled states and unambiguous labels.

Inputs need focus states, validation, nearby error text and appropriate keyboard behavior.

Cards need consistent padding, radius, hierarchy and restrained shadows.

Maps must remain usable: overlays cannot block critical map interactions, current location stays visible and SOS stays distinct.

## UI Template Rule
Templates are visual references, not authority over functionality.

For each template:
1. Preserve supported SheDrive features.
2. Remove unsupported controls.
3. Replace mock data with real data.
4. Preserve existing navigation/business logic.
5. Never force a template feature into the product.
6. Adapt design when exact fitting would break workflow.
