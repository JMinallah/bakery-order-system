/// Build-time settings, passed with --dart-define. Example:
///   flutter run --dart-define=API_URL=http://192.168.1.20:4000/api
class AppConfig {
  /// 10.0.2.2 is how the Android emulator reaches the computer's localhost.
  /// On a real phone, use your computer's Wi-Fi IP address instead.
  static const apiUrl = String.fromEnvironment(
    'API_URL',
    defaultValue:
        'https://bakery-mak-sys.indiasouthcentral.cloudapp.azure.com/api',
  );

  /// Local development only: identifies the user to the backend without
  /// Firebase (requires AUTH_DEV_BYPASS=true on the backend). Leave empty
  /// once Firebase sign-in is wired up.
  static const devUser = String.fromEnvironment('DEV_USER', defaultValue: '');
}

/// Separate FastAPI server used for AI image generation.
/// Android emulator: http://10.0.2.2:8000
/// Fedora desktop:   http://127.0.0.1:8000
/// Separate FastAPI server used for AI image generation.
class ImageApiConfig {
  static const String baseUrl = String.fromEnvironment(
    'IMAGE_API_URL',
    defaultValue: 'https://flutter-hf-image-api.onrender.com',
  );
}
