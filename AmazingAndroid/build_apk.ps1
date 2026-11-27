$ErrorActionPreference = "Stop"

$projRoot   = $PSScriptRoot
$appMain    = "$projRoot\app\src\main"
$buildDir   = "$projRoot\build"
$androidDir = "S:\2022.3.62f3\Editor\Data\PlaybackEngines\AndroidPlayer"
$buildTools = "$androidDir\SDK\build-tools\34.0.0"
$platform   = "$androidDir\SDK\platforms\android-34\android.jar"
$jdkBin     = "$androidDir\OpenJDK\bin"

New-Item -ItemType Directory -Force "$appMain\res\mipmap-xxxhdpi" | Out-Null
New-Item -ItemType Directory -Force "$buildDir\gen" | Out-Null
New-Item -ItemType Directory -Force "$buildDir\obj" | Out-Null
New-Item -ItemType Directory -Force "$buildDir\dex" | Out-Null
New-Item -ItemType Directory -Force "$buildDir\res" | Out-Null

# 1. Generate 192x192 ic_launcher.png from Steve Capps' 1984 32x32 ICN# resource icon
Add-Type -AssemblyName System.Drawing
$iconRows = @(
    0x00063000, 0x001F4800, 0x003F8000, 0x00000000, 0x017FFE00, 0x02082100, 0x03EF7D00, 0x04010080,
    0x05FFF780, 0x08000040, 0x0E7F3E40, 0x10410220, 0x1389F1E0, 0x20080010, 0x3FFFFF90, 0x40000008,
    0x78FFF8F8, 0x80000404, 0xFFF8FFFC, 0x80088004, 0x80088004, 0x800880C4, 0x80088324, 0xFFF8CC2C,
    0x00001320, 0x000014E0, 0x00001020, 0x00001120, 0x00000C20, 0x00000340, 0x00000080, 0x00000000
)
$bmp = New-Object System.Drawing.Bitmap(192, 192)
$black = [System.Drawing.Color]::FromArgb(255, 0, 0, 0)
$white = [System.Drawing.Color]::FromArgb(255, 255, 255, 255)
for ($py = 0; $py -lt 192; $py++) {
    for ($px = 0; $px -lt 192; $px++) {
        $border = ($px -lt 6 -or $px -ge 186 -or $py -lt 6 -or $py -ge 186)
        $bmp.SetPixel($px, $py, $(if ($border) { $black } else { $white }))
    }
}
$scale = 5
$offset = 16
for ($y = 0; $y -lt 32; $y++) {
    $rowBits = [int]$iconRows[$y]
    for ($x = 0; $x -lt 32; $x++) {
        $bit = ($rowBits -shr (31 - $x)) -band 1
        if ($bit -ne 0) {
            for ($dy = 0; $dy -lt $scale; $dy++) {
                for ($dx = 0; $dx -lt $scale; $dx++) {
                    $bmp.SetPixel($offset + $x * $scale + $dx, $offset + $y * $scale + $dy, $black)
                }
            }
        }
    }
}
$iconPath = "$appMain\res\mipmap-xxxhdpi\ic_launcher.png"
$bmp.Save($iconPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output "1. Generated launcher icon: $iconPath"

# 2. Compile resources with aapt2
& "$buildTools\aapt2.exe" compile --dir "$appMain\res" -o "$buildDir\res\resources.zip"
if ($LASTEXITCODE -ne 0) { throw "aapt2 compile failed" }

# 3. Link resources into base APK + generate R.java (assets added below with normalized '/' paths)
$unalignedApk = "$buildDir\unaligned.apk"
if (Test-Path $unalignedApk) { Remove-Item $unalignedApk -Force }
& "$buildTools\aapt2.exe" link `
    -I $platform `
    --manifest "$appMain\AndroidManifest.xml" `
    -R "$buildDir\res\resources.zip" `
    --java "$buildDir\gen" `
    -o $unalignedApk
if ($LASTEXITCODE -ne 0) { throw "aapt2 link failed" }
Write-Output "2. Linked resources with aapt2"

# 4. Compile Java sources with javac
$javaFiles = @(
    "$appMain\java\com\swivelchairgames\amazing2d\MainActivity.java",
    "$buildDir\gen\com\swivelchairgames\amazing2d\R.java"
)
& "$jdkBin\javac.exe" -source 1.8 -target 1.8 -bootclasspath $platform -classpath $platform -d "$buildDir\obj" $javaFiles
if ($LASTEXITCODE -ne 0) { throw "javac failed" }
Write-Output "3. Compiled Java classes"

# 5. Convert .class files to classes.dex with d8
$env:JAVA_HOME = "$androidDir\OpenJDK"
$env:PATH = "$jdkBin;$env:PATH"
$classFiles = Get-ChildItem "$buildDir\obj" -Recurse -Filter "*.class" | Select-Object -ExpandProperty FullName
& "$buildTools\d8.bat" --lib $platform --min-api 24 --output "$buildDir\dex" $classFiles
if ($LASTEXITCODE -ne 0) { throw "d8 failed" }
Write-Output "4. Built classes.dex with d8"

# 6. Add classes.dex and assets/ (with strictly forward-slash ZIP paths) into unaligned.apk
& "$jdkBin\jar.exe" uf $unalignedApk -C "$buildDir\dex" classes.dex -C $appMain assets
if ($LASTEXITCODE -ne 0) { throw "jar uf failed" }

# 7. Zipalign
$alignedApk = "$buildDir\aligned.apk"
if (Test-Path $alignedApk) { Remove-Item $alignedApk -Force }
& "$buildTools\zipalign.exe" -f -p 4 $unalignedApk $alignedApk
if ($LASTEXITCODE -ne 0) { throw "zipalign failed" }
Write-Output "5. Zipaligned APK"

# 8. Generate debug keystore if needed and sign with apksigner
$keystore = "$buildDir\debug.keystore"
if (-not (Test-Path $keystore)) {
    & "$jdkBin\keytool.exe" -genkeypair -v -keystore $keystore -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US"
}
$finalApk = "$projRoot\Amazing2D.apk"
if (Test-Path $finalApk) { Remove-Item $finalApk -Force }
& "$buildTools\apksigner.bat" sign --ks $keystore --ks-pass pass:android --key-pass pass:android --out $finalApk $alignedApk
if ($LASTEXITCODE -ne 0) { throw "apksigner failed" }
Write-Output "6. Signed final APK: $finalApk ($((Get-Item $finalApk).Length) bytes)"
