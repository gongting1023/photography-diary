# Parallel video compression - skip existing webm, 4 at a time
$videoDir = "E:\Project\photography-diary\static\video"
$crf = 26
$duration = 8
$maxParallel = 4

$mp4Files = Get-ChildItem "$videoDir\*.mp4" | Where-Object { $_.Name -match '^\d+\.mp4$' } | Sort-Object { [int]($_.BaseName) }

$toCompress = @()
foreach ($f in $mp4Files) {
    $webmPath = "$videoDir\$($f.BaseName).webm"
    if (Test-Path $webmPath) {
        $wb = Get-Item $webmPath
        if ($wb.Length -gt 0) { continue }  # already has a valid webm, skip
    }
    $toCompress += $f
}

Write-Host "Already done: $($mp4Files.Count - $toCompress.Count)/$($mp4Files.Count)"
Write-Host "To compress: $($toCompress.Count) videos (parallel=$maxParallel)"
Write-Host ""

if ($toCompress.Count -eq 0) {
    Write-Host "All videos already compressed!" -ForegroundColor Green
    exit 0
}

$queue = [System.Collections.Queue]::new()
foreach ($f in $toCompress) { $queue.Enqueue($f) }

$active = @()
$total = $toCompress.Count
$done = 0

while ($queue.Count -gt 0 -or $active.Count -gt 0) {
    while ($queue.Count -gt 0 -and $active.Count -lt $maxParallel) {
        $f = $queue.Dequeue()
        $webm = "$videoDir\$($f.BaseName).webm"
        $p = Start-Process -FilePath "ffmpeg" -ArgumentList @(
            "-i", $f.FullName,
            "-c:v", "libvpx-vp9",
            "-crf", "$crf",
            "-b:v", "0",
            "-an",
            "-t", "$duration",
            "-vf", "scale=1920:1080",
            $webm,
            "-y"
        ) -NoNewWindow -PassThru
        $active += @{ Proc = $p; File = $f; Webm = $webm }
    }

    Start-Sleep -Milliseconds 500
    foreach ($job in $active) {
        if ($job.Proc.HasExited) {
            $done++
            $percent = [math]::Round($done / $total * 100, 1)
            if (Test-Path $job.Webm) {
                $size = [math]::Round((Get-Item $job.Webm).Length / 1MB, 2)
                Write-Host "[$percent%] $($job.File.Name) -> $($job.File.BaseName).webm ($size MB)" -ForegroundColor Green
            } else {
                Write-Host "[$percent%] $($job.File.Name) FAILED" -ForegroundColor Red
            }
        }
    }
    $active = @($active | Where-Object { -not $_.Proc.HasExited })
}

Write-Host ""
Write-Host "Done! $total videos compressed." -ForegroundColor Cyan
