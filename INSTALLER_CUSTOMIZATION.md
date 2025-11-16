# Installer Customization Guide

## Overview

The Wolo Pharmacy installer has been enhanced with:
- ✨ Custom welcome and finish pages
- 🎨 Professional branding
- 📝 Detailed component selection
- 🔄 Progress indicators with messages
- 💬 Interactive user messages
- 📋 License agreement page
- 🚀 Launch option after installation

## Installer Features

### Welcome Page
- **Title**: "Welcome to Wolo Pharmacy"
- **Content**: 
  - Feature list
  - Developer information (Ashong Aaron Nii Nortey)
  - Contact details
  - Professional presentation

### License Page
- Displays MIT License
- Shows copyright information
- Developer attribution

### Components Page
Users can select:
1. **Wolo Pharmacy Application** (Required)
2. **Desktop Shortcut** (Optional)
3. **Start Menu Shortcuts** (Optional)
4. **Quick Launch Shortcut** (Optional)

### Directory Selection
- Custom installation path
- Clear instructions
- Default: Program Files

### Installation Progress
- Real-time progress updates
- Detailed status messages:
  - "Installing Wolo Pharmacy..."
  - "Creating application data directory..."
  - "Writing registry entries..."
  - "Creating shortcuts..."

### Finish Page
- Success message
- Launch option
- GitHub link
- Support contact information
- Next steps guide

## Customization Options

### 1. Change Welcome Message

Edit `build/installer-custom.nsh`:

```nsis
!define MUI_WELCOMEPAGE_TEXT "Your custom welcome message here..."
```

### 2. Add Custom Images

1. **Sidebar Image**: 
   - Size: 164x314 pixels
   - Format: 24-bit BMP
   - Place in: `build/sidebar.bmp`
   - Update `package.json` to include it

2. **Header Image**:
   - Size: 150x57 pixels
   - Format: BMP
   - Add to installer script

### 3. Modify Component Descriptions

Edit the `LangString` sections in `installer-custom.nsh`:

```nsis
LangString DESC_SecMain ${LANG_ENGLISH} "Your description here"
```

### 4. Change Finish Page

Edit the `MUI_FINISHPAGE_*` definitions:

```nsis
!define MUI_FINISHPAGE_TITLE "Your Title"
!define MUI_FINISHPAGE_TEXT "Your message"
```

### 5. Add Custom Pages

You can add custom pages using NSIS macros:

```nsis
!insertmacro MUI_PAGE_CUSTOMFUNCTION_PRE customPagePre
!insertmacro MUI_PAGE_CUSTOMFUNCTION_SHOW customPageShow
```

## Build Process

1. **Pre-build**: 
   - Cleans dist directory
   - Runs optimization script
   - Removes development files

2. **Build**:
   - Packages application
   - Creates installer with custom script
   - Includes all resources

3. **Output**:
   - `Wolo Pharmacy-1.0.0-Setup.exe` (Installer)
   - `Wolo Pharmacy-1.0.0-portable.exe` (Portable)

## Testing the Installer

1. Build the installer:
   ```bash
   npm run build:win:installer
   ```

2. Test installation:
   - Run the installer
   - Test all components
   - Verify shortcuts
   - Check registry entries

3. Test uninstallation:
   - Use Control Panel or Start Menu
   - Verify data preservation
   - Check cleanup

## Advanced Customization

### Adding Animations

NSIS supports custom UI plugins. You can:
- Add progress animations
- Custom splash screens
- Animated logos

### Custom Dialogs

Create custom dialogs using NSIS:
```nsis
nsDialogs::Create 1018
Pop $0
```

### Registry Customization

Add custom registry entries:
```nsis
WriteRegStr HKLM "Software\WoloPharmacy" "Version" "1.0.0"
```

## Troubleshooting

### Installer Not Showing Custom UI
- Check that `installer-custom.nsh` is in `build/` directory
- Verify `include` path in `package.json`
- Ensure NSIS syntax is correct

### Images Not Displaying
- Verify image format (BMP, 24-bit)
- Check image dimensions
- Ensure file paths are correct

### Shortcuts Not Creating
- Check user permissions
- Verify shortcut paths
- Review component selection

## Support

For installer customization help:
- Email: aaronashong111@gmail.com
- GitHub: https://github.com/Ashonlogist/Wolo-Pharmacy-app

---

**Note**: Always test the installer thoroughly before distribution!

