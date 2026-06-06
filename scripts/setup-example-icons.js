const fs = require('fs');
const path = require('path');

const DEFAULT_SOURCE_NAME = 'example-icons';
const IOS_APPICONSET = path.join('Assets.xcassets', 'AppIcon.appiconset');
const ANDROID_MAIN = path.join('android', 'app', 'src', 'main');
const PACKAGE_NAME = '@vinicius_santos/react-native-app-icon-changer';
const LEGACY_PACKAGE_NAME = 'react-native-app-icon-changer';

function naturalCompare(left, right) {
  return left.localeCompare(right, undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

function toAlternativeIconName(sourceName) {
  const suffix = sourceName.replace(DEFAULT_SOURCE_NAME, '');

  return `ExampleIcon${suffix}`;
}

function toAndroidResourceSuffix(iconName) {
  return iconName
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([a-zA-Z])([0-9])$/g, '$1_$2')
    .toLowerCase();
}

function getIconMetadata(sourceName) {
  const isDefault = sourceName === DEFAULT_SOURCE_NAME;
  const componentSuffix = isDefault
    ? 'Default'
    : toAlternativeIconName(sourceName);
  const resourceSuffix = isDefault
    ? 'default'
    : toAndroidResourceSuffix(componentSuffix);

  return {
    sourceName,
    iosName: isDefault ? 'AppIcon' : componentSuffix,
    androidIconName: `ic_launcher_${resourceSuffix}`,
    androidRoundIconName: `ic_launcher_round_${resourceSuffix}`,
    componentSuffix,
    isDefault,
  };
}

function isIconSet(rootDir, sourceName) {
  return (
    fs.existsSync(path.join(rootDir, sourceName, IOS_APPICONSET)) &&
    fs.existsSync(path.join(rootDir, sourceName, 'android'))
  );
}

function discoverIconSets(iconsRoot) {
  if (!fs.existsSync(iconsRoot)) {
    throw new Error(`Icon source folder does not exist: ${iconsRoot}`);
  }

  const sourceNames = fs
    .readdirSync(iconsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((sourceName) => isIconSet(iconsRoot, sourceName))
    .sort(naturalCompare);

  if (!sourceNames.includes(DEFAULT_SOURCE_NAME)) {
    throw new Error(
      `Missing default icon source folder: ${path.join(
        iconsRoot,
        DEFAULT_SOURCE_NAME
      )}`
    );
  }

  return [
    DEFAULT_SOURCE_NAME,
    ...sourceNames.filter((sourceName) => sourceName !== DEFAULT_SOURCE_NAME),
  ].map(getIconMetadata);
}

function renderAndroidAliases(iconSets) {
  return iconSets
    .map(
      (iconSet) => `    <activity-alias
      android:name="\${applicationId}.MainActivity${iconSet.componentSuffix}"
      android:targetActivity=".MainActivity"
      android:icon="@mipmap/${iconSet.androidIconName}"
      android:roundIcon="@mipmap/${iconSet.androidRoundIconName}"
      android:label="@string/app_name"
      android:enabled="false"
      android:exported="true">
      <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
      </intent-filter>
    </activity-alias>`
    )
    .join('\n');
}

function renderIosBundleIcons(iconSets) {
  const defaultIcon = iconSets.find((iconSet) => iconSet.isDefault);
  const alternateIcons = iconSets.filter((iconSet) => !iconSet.isDefault);

  return `\t<key>CFBundleIcons</key>
\t<dict>
\t\t<key>CFBundlePrimaryIcon</key>
\t\t<dict>
\t\t\t<key>CFBundleIconFiles</key>
\t\t\t<array>
\t\t\t\t<string>${defaultIcon.iosName}</string>
\t\t\t</array>
\t\t</dict>
\t\t<key>CFBundleAlternateIcons</key>
\t\t<dict>
${alternateIcons
  .map(
    (iconSet) => `\t\t\t<key>${iconSet.iosName}</key>
\t\t\t<dict>
\t\t\t\t<key>CFBundleIconFiles</key>
\t\t\t\t<array>
\t\t\t\t\t<string>${iconSet.iosName}</string>
\t\t\t\t</array>
\t\t\t</dict>`
  )
  .join('\n')}
\t\t</dict>
\t</dict>`;
}

function renderExampleApp() {
  return `/**
 * Example app for react-native-app-icon-changer.
 *
 * @format
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import {
  getActiveIcon,
  getAllAlternativeIcons,
  resetIcon,
  setIcon,
} from '${PACKAGE_NAME}';

const FALLBACK_ICONS = ['ExampleIcon1', 'ExampleIcon2', 'ExampleIcon3'];

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [activeIcon, setActiveIcon] = useState<string>('Unknown');
  const [availableIcons, setAvailableIcons] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isChanging, setIsChanging] = useState(false);
  const [message, setMessage] = useState('Loading icons...');

  const iconOptions = useMemo(() => {
    const alternatives = availableIcons.filter(icon => icon !== 'Default');

    return alternatives.length > 0 ? alternatives : FALLBACK_ICONS;
  }, [availableIcons]);

  const refreshIconState = useCallback(async () => {
    const [currentIcon, icons] = await Promise.all([
      getActiveIcon(),
      getAllAlternativeIcons(),
    ]);

    setActiveIcon(currentIcon ?? 'Default');
    setAvailableIcons(icons);
  }, []);

  useEffect(() => {
    refreshIconState()
      .then(() => setMessage('Choose an app icon to test.'))
      .catch(error =>
        setMessage(error instanceof Error ? error.message : String(error)),
      )
      .finally(() => setIsLoading(false));
  }, [refreshIconState]);

  const changeIcon = useCallback(
    async (iconName: string) => {
      setIsChanging(true);
      setMessage(\`Changing icon to \${iconName}...\`);

      try {
        await setIcon(iconName);
        await refreshIconState();
        setMessage(\`Icon change requested: \${iconName}\`);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : String(error));
      } finally {
        setIsChanging(false);
      }
    },
    [refreshIconState],
  );

  const restoreDefaultIcon = useCallback(async () => {
    setIsChanging(true);
    setMessage('Resetting icon...');

    try {
      await resetIcon();
      await refreshIconState();
      setMessage('Default icon requested.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsChanging(false);
    }
  }, [refreshIconState]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>App Icon Changer</Text>
        <Text style={styles.label}>Active icon</Text>
        <Text style={styles.activeIcon}>{activeIcon}</Text>

        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator />
            <Text style={styles.message}>{message}</Text>
          </View>
        ) : (
          <View style={styles.actions}>
            {iconOptions.map(iconName => (
              <IconButton
                key={iconName}
                disabled={isChanging}
                label={iconName}
                onPress={() => changeIcon(iconName)}
              />
            ))}
            <IconButton
              disabled={isChanging}
              label="Default"
              onPress={restoreDefaultIcon}
              variant="secondary"
            />
          </View>
        )}

        <Text style={styles.message}>{message}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function IconButton({
  disabled,
  label,
  onPress,
  variant = 'primary',
}: {
  disabled: boolean;
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.secondaryButton,
        disabled && styles.disabledButton,
        pressed && !disabled && styles.pressedButton,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          variant === 'secondary' && styles.secondaryButtonText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fb',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#111827',
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 32,
  },
  label: {
    color: '#4b5563',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  activeIcon: {
    color: '#111827',
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 24,
  },
  actions: {
    gap: 12,
  },
  loading: {
    alignItems: 'flex-start',
    gap: 12,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 8,
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  secondaryButton: {
    backgroundColor: '#ffffff',
    borderColor: '#d1d5db',
    borderWidth: 1,
  },
  disabledButton: {
    opacity: 0.5,
  },
  pressedButton: {
    opacity: 0.82,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButtonText: {
    color: '#111827',
  },
  message: {
    color: '#374151',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 24,
  },
});

export default App;
`;
}

function renderExampleMetroConfig() {
  return `const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');
const localPackageEntry = path.join(workspaceRoot, 'src', 'index.tsx');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [workspaceRoot],
  resolver: {
    resolveRequest(context, moduleName, platform) {
      if (moduleName === '${PACKAGE_NAME}') {
        return {
          type: 'sourceFile',
          filePath: localPackageEntry,
        };
      }

      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
`;
}

function copyDirectory(sourceDir, destinationDir) {
  fs.rmSync(destinationDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(destinationDir), { recursive: true });
  fs.cpSync(sourceDir, destinationDir, { recursive: true });
}

function copyIosIcons(iconSets, iconsRoot, iosAppDir) {
  const assetsDir = path.join(iosAppDir, 'Images.xcassets');

  for (const iconSet of iconSets) {
    const sourceDir = path.join(iconsRoot, iconSet.sourceName, IOS_APPICONSET);
    const destinationDir = path.join(
      assetsDir,
      `${iconSet.iosName}.appiconset`
    );

    copyDirectory(sourceDir, destinationDir);
  }
}

function copyAndroidIcons(iconSets, iconsRoot, androidResDir) {
  for (const iconSet of iconSets) {
    const sourceAndroidDir = path.join(
      iconsRoot,
      iconSet.sourceName,
      'android'
    );
    const densityDirs = fs
      .readdirSync(sourceAndroidDir, { withFileTypes: true })
      .filter(
        (entry) => entry.isDirectory() && entry.name.startsWith('mipmap-')
      )
      .map((entry) => entry.name);

    for (const densityDir of densityDirs) {
      const sourceIcon = path.join(
        sourceAndroidDir,
        densityDir,
        'ic_launcher.png'
      );

      if (!fs.existsSync(sourceIcon)) {
        throw new Error(`Missing Android icon: ${sourceIcon}`);
      }

      const destinationDensityDir = path.join(androidResDir, densityDir);
      fs.mkdirSync(destinationDensityDir, { recursive: true });
      fs.copyFileSync(
        sourceIcon,
        path.join(destinationDensityDir, `${iconSet.androidIconName}.png`)
      );
      fs.copyFileSync(
        sourceIcon,
        path.join(destinationDensityDir, `${iconSet.androidRoundIconName}.png`)
      );
    }
  }
}

function findIosAppDir(exampleRoot) {
  const iosRoot = path.join(exampleRoot, 'ios');

  if (!fs.existsSync(iosRoot)) {
    throw new Error(`iOS project folder does not exist: ${iosRoot}`);
  }

  const appDir = fs
    .readdirSync(iosRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(iosRoot, entry.name))
    .find(
      (candidate) =>
        fs.existsSync(path.join(candidate, 'Info.plist')) &&
        fs.existsSync(path.join(candidate, 'Images.xcassets'))
    );

  if (!appDir) {
    throw new Error(
      `Could not find an iOS app folder with Info.plist and Images.xcassets in ${iosRoot}`
    );
  }

  return appDir;
}

function findXmlElementEnd(content, elementStart) {
  const tagPattern =
    /<\/?(dict|array|string|true|false|integer|real|date|data)\b[^>]*>/g;
  tagPattern.lastIndex = elementStart;

  let depth = 0;
  let firstTag = true;
  let match;

  while ((match = tagPattern.exec(content))) {
    const tag = match[0];
    const isClosingTag = tag.startsWith('</');
    const isSelfClosingTag = tag.endsWith('/>');

    if (firstTag && !isClosingTag) {
      firstTag = false;

      if (isSelfClosingTag) {
        return tagPattern.lastIndex;
      }
    }

    if (!isClosingTag && !isSelfClosingTag) {
      depth += 1;
    } else if (isClosingTag) {
      depth -= 1;

      if (depth === 0) {
        return tagPattern.lastIndex;
      }
    }
  }

  throw new Error('Could not find the end of the plist XML element');
}

function replacePlistKey(content, key, valueXml) {
  const keyPattern = new RegExp(`\\n?[ \\t]*<key>${key}</key>`);
  const keyMatch = content.match(keyPattern);

  if (keyMatch && keyMatch.index !== undefined) {
    const blockStart = keyMatch.index;
    const valueStart = blockStart + keyMatch[0].length;
    const firstTagMatch = content.slice(valueStart).match(/<[^!?][^>]*>/);

    if (!firstTagMatch || firstTagMatch.index === undefined) {
      throw new Error(`Could not find plist value for key: ${key}`);
    }

    const elementStart = valueStart + firstTagMatch.index;
    const blockEnd = findXmlElementEnd(content, elementStart);

    return `${content.slice(0, blockStart)}\n${valueXml}${content.slice(
      blockEnd
    )}`;
  }

  const rootDictEnd = content.lastIndexOf('</dict>');

  if (rootDictEnd === -1) {
    throw new Error('Could not find the root plist </dict> tag');
  }

  return `${content.slice(0, rootDictEnd)}${valueXml}\n${content.slice(
    rootDictEnd
  )}`;
}

function patchIosInfoPlist(infoPlistPath, iconSets) {
  const content = fs.readFileSync(infoPlistPath, 'utf8');
  const patched = replacePlistKey(
    content,
    'CFBundleIcons',
    renderIosBundleIcons(iconSets)
  );

  fs.writeFileSync(infoPlistPath, patched);
}

function patchAndroidManifest(manifestPath, iconSets) {
  const content = fs.readFileSync(manifestPath, 'utf8');
  const defaultIcon = iconSets.find((iconSet) => iconSet.isDefault);
  let patched = content;

  if (!patched.includes('android.permission.CHANGE_COMPONENT_ENABLED_STATE')) {
    patched = patched.replace(
      /(<manifest\b[^>]*>)/,
      '$1\n  <uses-permission android:name="android.permission.CHANGE_COMPONENT_ENABLED_STATE" />'
    );
  }

  patched = patched
    .replace(
      /android:icon="@mipmap\/[^"]+"/,
      `android:icon="@mipmap/${defaultIcon.androidIconName}"`
    )
    .replace(
      /android:roundIcon="@mipmap\/[^"]+"/,
      `android:roundIcon="@mipmap/${defaultIcon.androidRoundIconName}"`
    )
    .replace(/\n\s*<activity-alias[\s\S]*?<\/activity-alias>/g, '');

  const applicationEnd = patched.lastIndexOf('</application>');

  if (applicationEnd === -1) {
    throw new Error(`Could not find </application> in ${manifestPath}`);
  }

  patched = `${patched.slice(0, applicationEnd)}${renderAndroidAliases(
    iconSets
  )}\n  ${patched.slice(applicationEnd)}`;

  fs.writeFileSync(manifestPath, patched);
}

function patchExamplePackageJson(exampleRoot) {
  const packageJsonPath = path.join(exampleRoot, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`Example package.json does not exist: ${packageJsonPath}`);
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  delete packageJson.dependencies?.[LEGACY_PACKAGE_NAME];

  packageJson.dependencies = {
    ...packageJson.dependencies,
    [PACKAGE_NAME]: 'workspace:*',
  };

  fs.writeFileSync(
    packageJsonPath,
    `${JSON.stringify(packageJson, null, 2)}\n`
  );
}

function patchExampleTsConfig(exampleRoot) {
  const tsConfigPath = path.join(exampleRoot, 'tsconfig.json');

  if (!fs.existsSync(tsConfigPath)) {
    throw new Error(`Example tsconfig.json does not exist: ${tsConfigPath}`);
  }

  const tsConfig = JSON.parse(fs.readFileSync(tsConfigPath, 'utf8'));
  tsConfig.compilerOptions = {
    ...tsConfig.compilerOptions,
    baseUrl: '.',
    paths: {
      ...tsConfig.compilerOptions?.paths,
      [PACKAGE_NAME]: ['../src/index'],
    },
  };

  fs.writeFileSync(tsConfigPath, `${JSON.stringify(tsConfig, null, 2)}\n`);
}

function patchExampleMetroConfig(exampleRoot) {
  const metroConfigPath = path.join(exampleRoot, 'metro.config.js');

  if (!fs.existsSync(metroConfigPath)) {
    throw new Error(`Example metro.config.js does not exist: ${metroConfigPath}`);
  }

  fs.writeFileSync(metroConfigPath, renderExampleMetroConfig());
}

function linkLocalPackage(projectRoot, exampleRoot) {
  const nodeModulesDir = path.join(exampleRoot, 'node_modules');
  const packageLinkPath = path.join(nodeModulesDir, PACKAGE_NAME);
  const legacyPackageLinkPath = path.join(nodeModulesDir, LEGACY_PACKAGE_NAME);

  fs.mkdirSync(path.dirname(packageLinkPath), { recursive: true });

  if (fs.existsSync(legacyPackageLinkPath)) {
    fs.rmSync(legacyPackageLinkPath, { recursive: true, force: true });
  }

  if (fs.existsSync(packageLinkPath)) {
    fs.rmSync(packageLinkPath, { recursive: true, force: true });
  }

  fs.symlinkSync(
    projectRoot,
    packageLinkPath,
    process.platform === 'win32' ? 'junction' : 'dir'
  );
}

function writeExampleApp(exampleRoot) {
  fs.writeFileSync(path.join(exampleRoot, 'App.tsx'), renderExampleApp());
}

function setupExampleIcons(projectRoot = path.resolve(__dirname, '..')) {
  const iconsRoot = path.join(projectRoot, 'assets', 'example-icons');
  const exampleRoot = path.join(projectRoot, 'example');

  if (!fs.existsSync(exampleRoot)) {
    throw new Error(
      `Example project does not exist: ${exampleRoot}. Run yarn example first.`
    );
  }

  const iconSets = discoverIconSets(iconsRoot);
  const iosAppDir = findIosAppDir(exampleRoot);
  const androidMainDir = path.join(exampleRoot, ANDROID_MAIN);
  const androidManifestPath = path.join(androidMainDir, 'AndroidManifest.xml');
  const androidResDir = path.join(androidMainDir, 'res');

  if (!fs.existsSync(androidManifestPath)) {
    throw new Error(
      `AndroidManifest.xml does not exist: ${androidManifestPath}`
    );
  }

  copyIosIcons(iconSets, iconsRoot, iosAppDir);
  patchIosInfoPlist(path.join(iosAppDir, 'Info.plist'), iconSets);
  copyAndroidIcons(iconSets, iconsRoot, androidResDir);
  patchAndroidManifest(androidManifestPath, iconSets);
  patchExamplePackageJson(exampleRoot);
  patchExampleTsConfig(exampleRoot);
  patchExampleMetroConfig(exampleRoot);
  linkLocalPackage(projectRoot, exampleRoot);
  writeExampleApp(exampleRoot);

  return iconSets;
}

if (require.main === module) {
  try {
    const iconSets = setupExampleIcons();
    const iconNames = iconSets.map((iconSet) => iconSet.componentSuffix);

    console.log(`Configured example app icons: ${iconNames.join(', ')}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  discoverIconSets,
  linkLocalPackage,
  patchAndroidManifest,
  patchExampleMetroConfig,
  patchExamplePackageJson,
  patchExampleTsConfig,
  patchIosInfoPlist,
  renderExampleMetroConfig,
  renderExampleApp,
  renderAndroidAliases,
  renderIosBundleIcons,
  setupExampleIcons,
};
