param([string]$R, [string]$HunFile)
$enc = [Text.Encoding]::UTF8
$hun = @{}
foreach ($line in [IO.File]::ReadLines($HunFile, $enc)) { if ($line.StartsWith("#")) { continue }; $p = $line.Split(":", 3); if ($p.Count -lt 3 -or $p[1].Length -ne 1 -or $p[0].Length -ne 1) { continue }; $hun[$p[1]] += @($p[2]) }
$old = @{}
foreach ($l in [IO.File]::ReadLines("$PSScriptRoot\oldvar.tsv")) { $a = $l.Split("`t"); $old[[char]::ConvertFromUtf32([Convert]::ToInt32($a[0].Substring(2),16))] = [char]::ConvertFromUtf32([Convert]::ToInt32(($a[1].Split(" ")[0] -replace "<.*","").Substring(2),16)) }
$c = [IO.File]::ReadAllText((Join-Path $R "data/kanji/common.json"), $enc) | ConvertFrom-Json
$same = 0; $diff = @()
foreach ($k in $c.items) {
  $src = $hun[$k.char]; if (-not $src -and $old[$k.char]) { $src = $hun[$old[$k.char]] }
  $mine = "$($k.ko.hun) $($k.ko.eum)"
  $flat = ($src -join ", ").Split(",") | ForEach-Object { $_.Trim() }
  if ($flat -contains $mine) { $same++ } else { $diff += "$($k.char) 사이트[$mine] / 자료[$($src -join ' | ')]" }
}
"70자 중 자료와 똑같음 $same 자, 다름 $($diff.Count) 자"
$diff