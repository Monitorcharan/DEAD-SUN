import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'package:shelf/shelf.dart';
import 'package:shelf/shelf_io.dart' as shelf_io;
import 'package:shelf_static/shelf_static.dart';
import 'package:webview_flutter/webview_flutter.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // 1. Force Landscape Orientation for optimal gaming experience
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.landscapeLeft,
    DeviceOrientation.landscapeRight,
  ]);

  // 2. Full Immersive Sticky Mode (Hides status bar and Android navigation buttons)
  await SystemChrome.setEnabledSystemUIMode(
    SystemUiMode.immersiveSticky,
    overlays: [],
  );

  runApp(const RedSunApp());
}

class RedSunApp extends StatelessWidget {
  const RedSunApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'THE RED SUN',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: const Color(0xFF040207),
      ),
      home: const GameLaunchScreen(),
    );
  }
}

class GameLaunchScreen extends StatefulWidget {
  const GameLaunchScreen({super.key});

  @override
  State<GameLaunchScreen> createState() => _GameLaunchScreenState();
}

class _GameLaunchScreenState extends State<GameLaunchScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  WebViewController? _webViewController;
  HttpServer? _localServer;
  int _serverPort = 0;

  bool _isGameLoaded = false;
  bool _hasFatalError = false;
  double _loadProgress = 0.05;
  String _statusText = "INITIALIZING CORE SYSTEMS...";

  final List<String> _loadingSteps = [
    "ACQUIRING ORBITAL TELEMETRY...",
    "CALIBRATING SUIT THERMAL SHIELDS...",
    "MAPPING DESERT SECTOR REFUGEES...",
    "PRESSURIZING OXYGEN LIFE SUPPORT...",
    "WARNING: RED SUN LOOMING CLOSER...",
    "SYSTEMS PRIMED • ENTERING THE FIRESTORM"
  ];
  int _stepIdx = 0;
  Timer? _stepTimer;

  // Complete offline bundled asset manifest fallback list (84 assets)
  static const List<String> _fallbackAssetFiles = [
    "asset1.png", "asset2.png", "asset3.png", "asset4.png", "asset5.png",
    "asset6.png", "asset7.png", "astronaught .png", "astronaut.png", "audio.js",
    "background_scene_for_sun.png", "dialogue_astronaut.png", "dialogue_screen.png",
    "dialogue_screen_improved.png", "flare_48s.png", "flare_50s.png", "flare_52s.png",
    "flare_54s.png", "flare_56s.png", "flare_58s.png", "flare_60s.png", "flare_62s.png",
    "flare_64s.png", "flare_66s.png", "flare_68s.png", "flare_70s.png", "flare_72s.png",
    "flare_detail_51s.png", "flare_detail_52s.png", "flare_detail_53s.png", "flare_detail_54s.png",
    "flare_detail_55s.png", "flare_detail_56s.png", "frame_12s.png", "frame_18s.png",
    "frame_25s.png", "frame_35s.png", "frame_45s.png", "frame_55s.png", "frame_5s.png",
    "frame_65s.png", "frame_75s.png", "frame_85s.png", "game.js", "gameplay_active.png",
    "gameplay_screen.png", "giant_approaching1.png", "index.html", "logo_red_sun.jpg",
    "paused_screen.png", "pixi.min.js", "rec_cooling_card_active.png", "rec_dialogue.png",
    "rec_quip_bubble_active.png", "rec_step1_dialogue.png", "rec_step2_title.png",
    "rec_step3_countdown.png", "rec_step4_cooling_card.png", "rec_step5_quip.png",
    "rec_step6_terminal.png", "rec_supply_drop_active.png", "screen_dash.png",
    "screen_dialogue_final.png", "screen_firestorm_and_sun.png", "screen_gameover.png",
    "screen_gameplay_clean.png", "screen_gameplay_final.png", "screen_gameplay_pure.png",
    "screen_in_shade.png", "screen_paused_final.png", "screen_shade_quip.png",
    "screen_shade_verified.png", "screen_solar_flare_surge.png", "screen_sun_looming_close.png",
    "style.css", "sun.png", "sun_crop_50s.png", "sun_crop_51s.png", "sun_crop_52s.png",
    "sun_crop_53s.png", "sun_crop_54s.png", "sun_crop_55s.png", "sun_crop_56s.png",
    "sun_glow.png"
  ];

  @override
  void initState() {
    super.initState();

    // Pulsing breathing animation for the Red Sun logo
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat(reverse: true);

    _pulseAnimation = Tween<double>(begin: 0.94, end: 1.06).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );

    // Progress text cycler
    _stepTimer = Timer.periodic(const Duration(milliseconds: 650), (timer) {
      if (_stepIdx < _loadingSteps.length - 1) {
        setState(() {
          _stepIdx++;
          _statusText = _loadingSteps[_stepIdx];
          _loadProgress = (_stepIdx + 1) / (_loadingSteps.length + 1);
        });
      }
    });

    _startLocalGameServer();
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _stepTimer?.cancel();
    _localServer?.close(force: true);
    super.dispose();
  }

  /// Extracts web assets to device storage and starts a local shelf server on localhost loopback
  Future<void> _startLocalGameServer() async {
    setState(() {
      _hasFatalError = false;
      _statusText = "SYNCHRONIZING EMBEDDED SYSTEM...";
    });

    try {
      final appDocDir = await getApplicationDocumentsDirectory();
      final webDir = Directory('${appDocDir.path}/web_game');

      if (!await webDir.exists()) {
        await webDir.create(recursive: true);
      }

      // Discover bundled assets using modern Flutter 3.16+ API with fallback
      List<String> webAssetKeys = [];
      try {
        final manifest = await AssetManifest.loadFromAssetBundle(rootBundle);
        webAssetKeys = manifest
            .listAssets()
            .where((key) => key.startsWith('assets/web/'))
            .toList();
      } catch (manifestError) {
        debugPrint("AssetManifest discovery note: $manifestError");
      }

      if (webAssetKeys.isEmpty) {
        webAssetKeys = _fallbackAssetFiles.map((f) => 'assets/web/$f').toList();
      }

      // Extract all assets to the local app documents directory
      for (final assetKey in webAssetKeys) {
        final relativePath = assetKey.replaceFirst('assets/web/', '');
        final targetFile = File('${webDir.path}/$relativePath');

        try {
          final byteData = await rootBundle.load(assetKey);
          await targetFile.parent.create(recursive: true);
          await targetFile.writeAsBytes(
            byteData.buffer.asUint8List(
              byteData.offsetInBytes,
              byteData.lengthInBytes,
            ),
            flush: true,
          );
        } catch (assetErr) {
          debugPrint("Note extracting $assetKey: $assetErr");
        }
      }

      // Verify index.html is present
      final indexFile = File('${webDir.path}/index.html');
      if (!await indexFile.exists()) {
        throw Exception("Target game index.html could not be unpacked to ${webDir.path}");
      }

      // Start Shelf Static HTTP Server on loopback address (127.0.0.1)
      final pipeline = const Pipeline()
          .addMiddleware((innerHandler) {
            return (request) async {
              final response = await innerHandler(request);
              return response.change(
                headers: {
                  'Access-Control-Allow-Origin': '*',
                  'Cross-Origin-Resource-Policy': 'cross-origin',
                  'Cache-Control': 'no-cache',
                },
              );
            };
          })
          .addHandler(createStaticHandler(webDir.path, defaultDocument: 'index.html'));

      // Close previous server if active
      if (_localServer != null) {
        await _localServer!.close(force: true);
        _localServer = null;
      }

      // Bind to an ephemeral port on 127.0.0.1
      _localServer = await shelf_io.serve(
        pipeline,
        InternetAddress.loopbackIPv4,
        0, // 0 selects an available system port
      );
      _serverPort = _localServer!.port;
      final serverUrl = 'http://127.0.0.1:$_serverPort/index.html';
      debugPrint("Local game server running at $serverUrl");

      // Verify server is serving index.html before WebView load
      final client = HttpClient();
      client.connectionTimeout = const Duration(seconds: 3);
      try {
        final req = await client.getUrl(Uri.parse(serverUrl));
        final res = await req.close();
        if (res.statusCode != 200) {
          throw Exception("Loopback verification failed with code: ${res.statusCode}");
        }
      } finally {
        client.close();
      }

      _initWebViewController(serverUrl);
    } catch (e) {
      debugPrint("Server startup issue: $e");
      // Fallback: check if direct file exists and attempt loadFile
      try {
        final appDocDir = await getApplicationDocumentsDirectory();
        final indexFile = File('${appDocDir.path}/web_game/index.html');
        if (await indexFile.exists()) {
          _initWebViewController(indexFile.path, isFile: true);
          return;
        }
      } catch (fileErr) {
        debugPrint("File fallback issue: $fileErr");
      }

      setState(() {
        _hasFatalError = true;
        _statusText = "COMMUNICATION RELAY OFFLINE • TAP TO RETRY";
      });
    }
  }

  void _initWebViewController(String target, {bool isFile = false}) {
    late final WebViewController controller;
    controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFF040207))
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (url) {
            debugPrint("Game engine starting: $url");
            if (mounted) {
              setState(() {
                _statusText = "LINKING ORBITAL TELEMETRY...";
              });
            }
          },
          onPageFinished: (url) {
            debugPrint("Game engine loaded: $url");
            // Inject touch controls activation & mobile readiness
            controller.runJavaScript('''
              document.body.classList.add('touch-enabled');
              if (window.deadSunGame) {
                window.deadSunGame.touchMode = 'ON';
                window.deadSunGame.applyTouchMode();
              }
            ''');

            Future.delayed(const Duration(milliseconds: 750), () {
              if (mounted) {
                setState(() {
                  _loadProgress = 1.0;
                  _statusText = "ORBIT STABILIZED • ENTERING ATMOSPHERE";
                  _isGameLoaded = true;
                  _hasFatalError = false;
                });
              }
            });
          },
          onWebResourceError: (error) {
            debugPrint("Web resource error: ${error.description} (code: ${error.errorCode})");
            // Only flag fatal error if the main frame itself failed
            if (error.isForMainFrame ?? false) {
              if (mounted && !_isGameLoaded) {
                setState(() {
                  _hasFatalError = true;
                  _statusText = "CORE RELAY RE-ACQUIRING...";
                });
                // Automatic retry after 1.5 seconds
                Future.delayed(const Duration(milliseconds: 1500), () {
                  if (mounted && !_isGameLoaded) {
                    _startLocalGameServer();
                  }
                });
              }
            }
          },
        ),
      );

    if (isFile) {
      controller.loadFile(target);
    } else {
      controller.loadRequest(Uri.parse(target));
    }

    setState(() {
      _webViewController = controller;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF040207),
      body: Stack(
        children: [
          // 1. Hardware Accelerated Game Canvas Layer
          if (_webViewController != null)
            Positioned.fill(
              child: WebViewWidget(controller: _webViewController!),
            ),

          // 2. Animated Cinematic Intro & Loading Screen (Smoothly fades out once loaded)
          AnimatedOpacity(
            opacity: _isGameLoaded ? 0.0 : 1.0,
            duration: const Duration(milliseconds: 700),
            curve: Curves.easeOut,
            child: IgnorePointer(
              ignoring: _isGameLoaded,
              child: Container(
                width: double.infinity,
                height: double.infinity,
                decoration: const BoxDecoration(
                  gradient: RadialGradient(
                    center: Alignment(0.0, -0.2),
                    radius: 0.95,
                    colors: [
                      Color(0xFF220810),
                      Color(0xFF10040A),
                      Color(0xFF040207),
                    ],
                  ),
                ),
                child: Center(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 24),
                    child: FittedBox(
                      fit: BoxFit.scaleDown,
                      child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      // Glowing Breathing Red Sun Logo
                      ScaleTransition(
                        scale: _pulseAnimation,
                        child: Container(
                          width: 170,
                          height: 170,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFFFF3C00).withValues(alpha: 0.45),
                                blurRadius: 45,
                                spreadRadius: 10,
                              ),
                              BoxShadow(
                                color: const Color(0xFFFF7A22).withValues(alpha: 0.25),
                                blurRadius: 75,
                                spreadRadius: 20,
                              ),
                            ],
                          ),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(16),
                            child: Image.asset(
                              'assets/logo.jpg',
                              fit: BoxFit.cover,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 42),

                      // Title & Telemetry Progress Module
                      Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'THE RED SUN',
                            style: TextStyle(
                              fontFamily: 'sans-serif',
                              fontSize: 32,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 4.5,
                              color: Color(0xFFFF6230),
                              shadows: [
                                Shadow(
                                  color: Color(0xFFFF2200),
                                  blurRadius: 18,
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'SHELTER FROM THE RED GIANT • FLEE THE FIRESTORM',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 2.0,
                              color: const Color(0xFF43E1FF).withValues(alpha: 0.85),
                            ),
                          ),
                          const SizedBox(height: 20),

                          // Sci-fi Progress Bar
                          SizedBox(
                            width: 320,
                            height: 6,
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(3),
                              child: LinearProgressIndicator(
                                value: _loadProgress,
                                backgroundColor: const Color(0xFF14081E),
                                valueColor: const AlwaysStoppedAnimation<Color>(
                                  Color(0xFFFF7A22),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 12),

                          // Dynamic Telemetry Status Text
                          Text(
                            _statusText,
                            style: TextStyle(
                              fontFamily: 'monospace',
                              fontSize: 11,
                              letterSpacing: 1.5,
                              color: _hasFatalError
                                  ? const Color(0xFFFF4444)
                                  : const Color(0xFFFFBE4A),
                            ),
                          ),

                          if (_hasFatalError) ...[
                            const SizedBox(height: 14),
                            ElevatedButton(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF2A0C16),
                                foregroundColor: const Color(0xFFFF7A22),
                                side: const BorderSide(
                                  color: Color(0xFFFF7A22),
                                  width: 1.5,
                                ),
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 20,
                                  vertical: 10,
                                ),
                              ),
                              onPressed: _startLocalGameServer,
                              child: const Text(
                                'RECONNECT CORE ENGINE',
                                style: TextStyle(
                                  fontFamily: 'monospace',
                                  letterSpacing: 1.5,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ],
  ),
);
}
}
