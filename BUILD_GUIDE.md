# Build Guide for Wolo Pharmacy App

This guide explains how to build the Wolo Pharmacy application for distribution.

## Prerequisites

1. **Node.js** (v16 or higher)
2. **npm** (comes with Node.js)
3. **Git** (for version control)

## Installation

```bash
# Install dependencies
npm install
```

This will automatically:
- Install all required packages
- Rebuild native modules (better-sqlite3) for Electron

## Build Commands

### Quick Build (Current Platform)
```bash
npm run build
```
Builds for your current operating system.

### Windows Builds

#### Installer (NSIS)
```bash
npm run build:win:installer
```
Creates a Windows installer (.exe) that users can install.

#### Portable Version
```bash
npm run build:win:portable
```
Creates a portable version that doesn't require installation.

#### Both Installer and Portable
```bash
npm run build:win
```
Creates both installer and portable versions.

### macOS Build
```bash
npm run build:mac
```
Creates a .dmg file and .zip archive for macOS.

### Linux Build
```bash
npm run build:linux
```
Creates AppImage, .deb, and .rpm packages for Linux.

### Build for All Platforms
```bash
npm run build:all
```
**Note**: This requires running on each platform or using CI/CD.

### Development Build (Unpacked)
```bash
npm run pack
```
Creates an unpacked build in the `dist` folder for testing.

## Build Output

All builds are output to the `dist/` directory:

```
dist/
├── Wolo Pharmacy-1.0.0-x64.exe          # Windows installer (64-bit)
├── Wolo Pharmacy-1.0.0-ia32.exe         # Windows installer (32-bit)
├── Wolo Pharmacy-1.0.0-portable.exe     # Windows portable
├── Wolo Pharmacy-1.0.0-x64.dmg          # macOS disk image
├── Wolo Pharmacy-1.0.0-x64.AppImage     # Linux AppImage
└── ...
```

## Build Configuration

The build is configured in `package.json` under the `build` section:

### Key Settings

- **appId**: `com.wolo-pharmacy.app` - Unique application identifier
- **productName**: `Wolo Pharmacy` - Display name
- **compression**: `maximum` - Maximum file compression
- **asar**: `true` - Packages app files in ASAR archive
- **asarUnpack**: Unpacks `better-sqlite3` (native module)

### File Inclusion

The build automatically:
- ✅ Includes all necessary application files
- ✅ Excludes development files (check-db.js, fix-db.js, etc.)
- ✅ Excludes documentation files (.md, .txt)
- ✅ Excludes test files and examples
- ✅ Includes icons and resources

### Windows Specific

- **Installer**: NSIS installer with custom options
- **Shortcuts**: Creates desktop and start menu shortcuts
- **Icons**: Uses WOLO-PHARMACY.ico
- **Architectures**: x64 (64-bit) and ia32 (32-bit)

### macOS Specific

- **Targets**: DMG and ZIP
- **Category**: Business application
- **Icon**: WOLO-PHARMACY.png

### Linux Specific

- **Targets**: AppImage, DEB, RPM
- **Category**: Office application
- **Icon**: WOLO-PHARMACY.png

## Build Process

When you run `npm run build`, the following happens:

1. **Pre-build** (`prebuild` script):
   - Cleans the `dist` directory
   - Runs build optimization script
   - Removes development files

2. **Build** (electron-builder):
   - Packages application files
   - Creates ASAR archive
   - Compiles native modules
   - Creates platform-specific installers

3. **Post-build**:
   - Outputs are in `dist/` directory
   - Ready for distribution

## Optimization Features

### File Compression
- Maximum compression enabled
- Reduces installer size significantly

### ASAR Archive
- Packages app files in a single archive
- Faster startup times
- Better file organization

### Native Module Handling
- `better-sqlite3` is unpacked from ASAR
- Required for native database operations
- Automatically handled by electron-builder

### Development File Exclusion
The following files are automatically excluded:
- `check-db.js`
- `fix-db.js`
- `repair-db.js`
- `run-repair.js`
- `*.bak` files
- Documentation files
- Test files

## Troubleshooting

### Build Fails with "better-sqlite3" Error

```bash
# Rebuild native modules
npm run rebuild
```

### Build is Too Large

- Check `package.json` build.files section
- Ensure unnecessary files are excluded
- Verify compression is set to "maximum"

### Windows Build Fails

1. Ensure you're on Windows or using Windows build tools
2. Check that icon file exists: `WOLO-PHARMACY.ico`
3. Verify NSIS is installed (electron-builder installs it automatically)

### macOS Build Fails

1. Must be run on macOS
2. Requires Xcode Command Line Tools
3. May need code signing for distribution

### Linux Build Fails

1. Install required tools:
   ```bash
   # Ubuntu/Debian
   sudo apt-get install fakeroot
   
   # Fedora/RHEL
   sudo yum install rpm-build
   ```

## Code Signing (Optional)

For production distribution, you may want to code sign your application:

### Windows
- Requires a code signing certificate
- Configure in `package.json` build.win section

### macOS
- Requires Apple Developer account
- Configure in `package.json` build.mac section

### Linux
- Not typically required
- Can use GPG signing for packages

## Distribution

### Windows
- **Installer (.exe)**: Recommended for most users
- **Portable (.exe)**: For users who don't want to install

### macOS
- **DMG**: Standard macOS distribution format
- **ZIP**: Alternative distribution method

### Linux
- **AppImage**: Universal Linux format (recommended)
- **DEB**: For Debian/Ubuntu systems
- **RPM**: For Red Hat/Fedora systems

## Version Management

To update the version:

1. Edit `package.json`:
   ```json
   "version": "1.0.1"
   ```

2. Rebuild:
   ```bash
   npm run build
   ```

The version is automatically included in:
- Installer filenames
- Application metadata
- About dialog

## Continuous Integration

For automated builds, you can use:

- **GitHub Actions**: Build on push/tag
- **GitLab CI**: Similar to GitHub Actions
- **AppVeyor**: Windows builds
- **Travis CI**: Multi-platform builds

Example GitHub Actions workflow:
```yaml
name: Build
on: [push, pull_request]
jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm run build
```

## Best Practices

1. **Always test builds** before distribution
2. **Increment version** for each release
3. **Test on target platforms** when possible
4. **Keep dependencies updated**
5. **Document breaking changes**
6. **Create release notes**

## Support

For build issues:
- Check electron-builder documentation
- Review error messages carefully
- Ensure all prerequisites are installed
- Contact: aaronashong111@gmail.com

---

**Happy Building! 🚀**

