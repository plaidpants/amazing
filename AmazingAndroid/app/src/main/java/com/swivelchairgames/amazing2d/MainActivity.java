package com.swivelchairgames.amazing2d;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Color;
import android.media.AudioManager;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.view.DisplayCutout;
import android.view.HapticFeedbackConstants;
import android.view.OrientationEventListener;
import android.view.Surface;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {

    private WebView webView;
    private Vibrator vibrator;
    private OrientationEventListener orientationListener;
    private int currentRelDeg = 0;
    private int snappedSensorDeg = -1;
    private int safeLeft = 0, safeTop = 0, safeRight = 0, safeBottom = 0;
    private long backgroundStartElapsedMs = 0L;

    @SuppressLint({"SetJavaScriptEnabled", "ClickableViewAccessibility"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        requestWindowFeature(Window.FEATURE_NO_TITLE);
        setVolumeControlStream(AudioManager.STREAM_MUSIC);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }

        webView = new WebView(this);
        webView.setBackgroundColor(Color.WHITE);
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setLongClickable(false);
        webView.setOnLongClickListener(new View.OnLongClickListener() {
            @Override
            public boolean onLongClick(View v) {
                return true;
            }
        });

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setTextZoom(100);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager vm = (VibratorManager) getSystemService(VIBRATOR_MANAGER_SERVICE);
            if (vm != null) vibrator = vm.getDefaultVibrator();
        } else {
            vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
        }

        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void stepTick() {
                vibratePulse(13, 135, HapticFeedbackConstants.VIRTUAL_KEY);
            }

            @JavascriptInterface
            public void winBump() {
                vibratePulse(35, 210, HapticFeedbackConstants.LONG_PRESS);
            }
        }, "AndroidHaptics");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                pushDeviceOrientationToJs();
                pushSafeInsetsToJs();
            }
        });
        webView.setWebChromeClient(new WebChromeClient());

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            webView.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
                @Override
                public WindowInsets onApplyWindowInsets(View v, WindowInsets insets) {
                    DisplayCutout cutout = insets.getDisplayCutout();
                    float density = getResources().getDisplayMetrics().density;
                    if (cutout != null && density > 0f) {
                        safeLeft = (int) Math.ceil(cutout.getSafeInsetLeft() / density);
                        safeTop = (int) Math.ceil(cutout.getSafeInsetTop() / density);
                        safeRight = (int) Math.ceil(cutout.getSafeInsetRight() / density);
                        safeBottom = (int) Math.ceil(cutout.getSafeInsetBottom() / density);
                    } else {
                        safeLeft = safeTop = safeRight = safeBottom = 0;
                    }
                    pushSafeInsetsToJs();
                    return insets;
                }
            });
        }

        setContentView(webView);
        applyImmersiveFullscreen();

        orientationListener = new OrientationEventListener(this) {
            @Override
            public void onOrientationChanged(int orientation) {
                if (orientation == ORIENTATION_UNKNOWN) return;
                int nextSnapped = snapSensorAngleWithHysteresis(orientation, snappedSensorDeg);
                if (nextSnapped != snappedSensorDeg) {
                    snappedSensorDeg = nextSnapped;
                    int rel = computeRelativeRotationDeg(nextSnapped);
                    if (rel != currentRelDeg) {
                        currentRelDeg = rel;
                        pushDeviceOrientationToJs();
                    }
                }
            }
        };

        webView.loadUrl("file:///android_asset/www/index.html");
    }

    @SuppressWarnings("deprecation")
    private void vibratePulse(final long ms, final int amplitude, final int fallbackConstant) {
        if (vibrator != null && vibrator.hasVibrator()) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createOneShot(ms, amplitude));
            } else {
                vibrator.vibrate(ms);
            }
            return;
        }
        if (webView != null) {
            webView.post(new Runnable() {
                @Override
                public void run() {
                    webView.performHapticFeedback(
                            fallbackConstant,
                            HapticFeedbackConstants.FLAG_IGNORE_VIEW_SETTING);
                }
            });
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        applyImmersiveFullscreen();
        if (orientationListener != null && orientationListener.canDetectOrientation()) {
            orientationListener.enable();
        }
        if (webView != null) {
            webView.onResume();
            long bgMs = 0L;
            if (backgroundStartElapsedMs > 0L) {
                bgMs = SystemClock.elapsedRealtime() - backgroundStartElapsedMs;
                backgroundStartElapsedMs = 0L;
            }
            final long resumeBgMs = bgMs;
            webView.post(new Runnable() {
                @Override
                public void run() {
                    webView.evaluateJavascript(
                            "if (window.onAppResume) window.onAppResume(" + resumeBgMs + ");",
                            null);
                }
            });
        }
    }

    @Override
    protected void onPause() {
        if (orientationListener != null) {
            orientationListener.disable();
        }
        if (backgroundStartElapsedMs == 0L) {
            backgroundStartElapsedMs = SystemClock.elapsedRealtime();
        }
        if (webView != null) {
            webView.evaluateJavascript("if (window.onAppPause) window.onAppPause();", null);
            webView.onPause();
        }
        super.onPause();
    }

    private static int snapSensorAngleWithHysteresis(int angle, int prevSnapped) {
        int[] centers = {0, 90, 180, 270};
        if (prevSnapped >= 0) {
            int diff = Math.abs(angle - prevSnapped);
            if (diff > 180) diff = 360 - diff;
            if (diff < 60) return prevSnapped;
        }
        int best = 0;
        int bestDist = 360;
        for (int c : centers) {
            int d = Math.abs(angle - c);
            if (d > 180) d = 360 - d;
            if (d < bestDist) {
                bestDist = d;
                best = c;
            }
        }
        return best;
    }

    @SuppressWarnings("deprecation")
    private int computeRelativeRotationDeg(int sensorDeg) {
        int dispRot = getWindowManager().getDefaultDisplay().getRotation();
        int displayDeg = 0;
        if (dispRot == Surface.ROTATION_90) displayDeg = 90;
        else if (dispRot == Surface.ROTATION_180) displayDeg = 180;
        else if (dispRot == Surface.ROTATION_270) displayDeg = 270;

        int uprightSensorDeg = (360 - displayDeg) % 360;
        int deltaCW = (sensorDeg - uprightSensorDeg + 360) % 360;
        int cssDeg = (360 - deltaCW) % 360;
        if (cssDeg == 270) cssDeg = -90;
        return cssDeg;
    }

    private void pushDeviceOrientationToJs() {
        if (webView == null) return;
        final int deg = currentRelDeg;
        webView.post(new Runnable() {
            @Override
            public void run() {
                webView.evaluateJavascript(
                        "if (window.setDeviceOrientation) window.setDeviceOrientation(" + deg + ");",
                        null);
            }
        });
    }

    private void pushSafeInsetsToJs() {
        if (webView == null) return;
        final int l = safeLeft, t = safeTop, r = safeRight, b = safeBottom;
        webView.post(new Runnable() {
            @Override
            public void run() {
                webView.evaluateJavascript(
                        "if (window.setSafeInsets) window.setSafeInsets(" + l + "," + t + "," + r + "," + b + ");",
                        null);
            }
        });
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            applyImmersiveFullscreen();
        }
    }

    @Override
    public void onBackPressed() {
        // Prevent accidental back-gesture exit while dragging near screen edges
    }

    @SuppressWarnings("deprecation")
    private void applyImmersiveFullscreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                controller.setSystemBarsBehavior(
                        WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            View decorView = getWindow().getDecorView();
            decorView.setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_FULLSCREEN);
        }
    }
}
