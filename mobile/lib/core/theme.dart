import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Artisanal Bakery Palette & Design Tokens
/// Warm cream background, rich roasted cacao ink, berry accent, and soft warm shadows.
abstract final class AppColors {
  static const ink = Color(0xFF281912);
  static const ink2 = Color(0xFF453026);
  static const muted = Color(0xFF70594D);
  static const ground = Color(0xFFFAF6F0);
  static const surface = Color(0xFFFFFFFF);
  static const line = Color(0xFFECE1D6);
  static const lineStrong = Color(0xFFDFCEBF);
  static const sand = Color(0xFFF4ECE4);
  static const accent = Color(0xFFA62B52);
  static const accentHover = Color(0xFF861D3D);
  static const accentSoft = Color(0xFFF9ECF1);
  static const danger = Color(0xFF9E2A2B);
  static const dangerSoft = Color(0xFFFBE8E8);
  static const warn = Color(0xFF9A4C0B);
  static const warnSoft = Color(0xFFFDF0DE);
  static const ok = Color(0xFF2B6B38);
  static const okSoft = Color(0xFFE2F2E0);
  static const info = Color(0xFF235582);
  static const infoSoft = Color(0xFFE3EEF8);
  static const violet = Color(0xFF503784);
  static const violetSoft = Color(0xFFEDE8F8);
  static const gold = Color(0xFFB87310);
  static const goldSoft = Color(0xFFFDF5E6);
}

abstract final class AppShadows {
  static const card = [
    BoxShadow(color: Color(0x0A361F12), blurRadius: 18, offset: Offset(0, 5)),
    BoxShadow(color: Color(0x06361F12), blurRadius: 4, offset: Offset(0, 1)),
  ];

  static const elevated = [
    BoxShadow(color: Color(0x12361F12), blurRadius: 28, offset: Offset(0, 10)),
    BoxShadow(color: Color(0x08361F12), blurRadius: 8, offset: Offset(0, 2)),
  ];

  static const button = [
    BoxShadow(color: Color(0x28A62B52), blurRadius: 16, offset: Offset(0, 5)),
  ];
}

final _radius = BorderRadius.circular(16);

final appTheme = ThemeData(
  useMaterial3: true,
  colorScheme: ColorScheme.fromSeed(
    seedColor: AppColors.accent,
    primary: AppColors.accent,
    onPrimary: Colors.white,
    surface: AppColors.ground,
    onSurface: AppColors.ink,
    error: AppColors.danger,
    brightness: Brightness.light,
  ),
  scaffoldBackgroundColor: AppColors.ground,
  dividerColor: AppColors.line,
  appBarTheme: const AppBarTheme(
    backgroundColor: AppColors.ground,
    foregroundColor: AppColors.ink,
    elevation: 0,
    scrolledUnderElevation: 0,
    centerTitle: false,
    iconTheme: IconThemeData(color: AppColors.ink),
  ),
  textTheme: GoogleFonts.plusJakartaSansTextTheme(
    const TextTheme(
      headlineLarge: TextStyle(
        fontSize: 34,
        fontWeight: FontWeight.w800,
        letterSpacing: -0.8,
        color: AppColors.ink,
        height: 1.15,
      ),
      headlineMedium: TextStyle(
        fontSize: 28,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.6,
        color: AppColors.ink,
        height: 1.1,
      ),
      titleLarge: TextStyle(
        fontSize: 21,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.3,
        color: AppColors.ink,
      ),
      titleMedium: TextStyle(
        fontSize: 17,
        fontWeight: FontWeight.w600,
        letterSpacing: -0.2,
        color: AppColors.ink,
      ),
      bodyLarge: TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.w400,
        color: AppColors.ink,
        height: 1.45,
      ),
      bodyMedium: TextStyle(
        fontSize: 15,
        fontWeight: FontWeight.w400,
        color: AppColors.ink,
        height: 1.45,
      ),
      bodySmall: TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w400,
        color: AppColors.muted,
        height: 1.4,
      ),
    ),
  ),
  filledButtonTheme: FilledButtonThemeData(
    style: FilledButton.styleFrom(
      minimumSize: const Size.fromHeight(54),
      elevation: 0,
      backgroundColor: AppColors.accent,
      foregroundColor: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: _radius),
      textStyle: const TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.1,
      ),
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 15),
    ),
  ),
  outlinedButtonTheme: OutlinedButtonThemeData(
    style: OutlinedButton.styleFrom(
      minimumSize: const Size.fromHeight(50),
      foregroundColor: AppColors.ink,
      side: const BorderSide(color: AppColors.lineStrong, width: 1.5),
      shape: RoundedRectangleBorder(borderRadius: _radius),
      textStyle: const TextStyle(
        fontSize: 15,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.1,
      ),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
    ),
  ),
  textButtonTheme: TextButtonThemeData(
    style: TextButton.styleFrom(
      minimumSize: const Size(44, 44),
      foregroundColor: AppColors.accent,
      textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
    ),
  ),
  inputDecorationTheme: InputDecorationTheme(
    filled: true,
    fillColor: AppColors.surface,
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(14),
      borderSide: const BorderSide(color: AppColors.line, width: 1.5),
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(14),
      borderSide: const BorderSide(color: AppColors.line, width: 1.5),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(14),
      borderSide: const BorderSide(color: AppColors.accent, width: 2),
    ),
    errorBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(14),
      borderSide: const BorderSide(color: AppColors.danger, width: 1.5),
    ),
    focusedErrorBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(14),
      borderSide: const BorderSide(color: AppColors.danger, width: 2),
    ),
    hintStyle: const TextStyle(
      color: Color(0xFF968175),
      fontSize: 15,
      fontWeight: FontWeight.w400,
    ),
  ),
  chipTheme: ChipThemeData(
    backgroundColor: AppColors.surface,
    selectedColor: AppColors.accentSoft,
    side: const BorderSide(color: AppColors.line, width: 1.5),
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
    labelStyle: const TextStyle(
      fontSize: 14,
      fontWeight: FontWeight.w600,
      color: AppColors.ink,
    ),
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
    showCheckmark: false,
  ),
  navigationBarTheme: NavigationBarThemeData(
    backgroundColor: AppColors.surface,
    elevation: 2,
    indicatorColor: AppColors.accentSoft,
    height: 72,
    labelTextStyle: WidgetStateProperty.resolveWith((states) {
      if (states.contains(WidgetState.selected)) {
        return const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: AppColors.accent,
        );
      }
      return const TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w500,
        color: AppColors.muted,
      );
    }),
    iconTheme: WidgetStateProperty.resolveWith((states) {
      if (states.contains(WidgetState.selected)) {
        return const IconThemeData(color: AppColors.accent, size: 24);
      }
      return const IconThemeData(color: AppColors.muted, size: 24);
    }),
  ),
  bottomSheetTheme: const BottomSheetThemeData(
    backgroundColor: AppColors.surface,
    surfaceTintColor: Colors.transparent,
    showDragHandle: true,
    dragHandleColor: AppColors.lineStrong,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
    ),
  ),
  cardTheme: CardThemeData(
    color: AppColors.surface,
    elevation: 0,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(18),
      side: const BorderSide(color: AppColors.line),
    ),
    margin: EdgeInsets.zero,
  ),
  snackBarTheme: const SnackBarThemeData(
    backgroundColor: AppColors.ink,
    behavior: SnackBarBehavior.floating,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.all(Radius.circular(14)),
    ),
  ),
);
