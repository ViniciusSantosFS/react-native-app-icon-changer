module.exports = {
  dependency: {
    platforms: {
      android: {
        sourceDir: './android',
        packageImportPath: 'import com.appiconchanger.AppIconChangerPackage;',
        packageInstance: 'new AppIconChangerPackage()',
      },
    },
  },
};
