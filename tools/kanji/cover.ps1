# libhangul hanja.txt(한 글자 항목)가 단어장 한자의 훈음을 얼마나 담고 있는지 확인
param([string]$R, [string]$HunFile)
$enc = [Text.Encoding]::UTF8
$hun = @{}
foreach ($line in [IO.File]::ReadLines($HunFile, $enc)) {
  if ($line.StartsWith("#")) { continue }
  $p = $line.Split(":", 3)
  if ($p.Count -lt 3 -or $p[1].Length -ne 1 -or $p[0].Length -ne 1 -or -not $p[2]) { continue }
  if (-not $hun.ContainsKey($p[1])) { $hun[$p[1]] = @() }
  $hun[$p[1]] += $p[2]
}
function J($p) { [IO.File]::ReadAllText((Join-Path $R $p), $enc) | ConvertFrom-Json }
function Chars($words) { $h = @{}; foreach ($w in $words) { foreach ($c in $w.ToCharArray()) { $n = [int]$c; if ($n -ge 0x4E00 -and $n -le 0x9FFF) { $h["$c"] = 1 } } }; $h }
$n3 = Chars ((J "data/n3/vocab.json").items | ForEach-Object { $_.word })
$n1 = Chars (@((J "data/n1/vocab.json").items | ForEach-Object { $_.word }) + @((J "data/vocabulary.json").items | ForEach-Object { $_.word }))
$all = @{}; foreach ($k in $n3.Keys + $n1.Keys) { $all[$k] = 1 }
$miss = @($all.Keys | Where-Object { -not $hun.ContainsKey($_) })
"한 글자 훈음 항목 수: " + $hun.Count
"단어장 한자 {0}자 중 훈음 있음 {1}자, 없음 {2}자" -f $all.Count, ($all.Count - $miss.Count), $miss.Count
"없음: " + ($miss -join "")
foreach ($c in "阻","憂","謙","気","学","国","合","見") { $c + " → " + ($(if ($hun[$c]) { $hun[$c] -join " | " } else { "(없음)" })) }

$old = @{}
foreach ($l in [IO.File]::ReadLines("$PSScriptRoot\oldvar.tsv")) { $a = $l.Split("`t"); $from = [char]::ConvertFromUtf32([Convert]::ToInt32($a[0].Substring(2),16)); $to = @($a[1].Split(" ") | ForEach-Object { [char]::ConvertFromUtf32([Convert]::ToInt32(($_ -replace "<.*","").Substring(2),16)) }); $old[$from] = $to }
$viaOld = @($miss | Where-Object { $old[$_] -and @($old[$_] | Where-Object { $hun.ContainsKey($_) }).Count -gt 0 })
$still = @($miss | Where-Object { $viaOld -notcontains $_ })
"옛 글자체로 찾음 {0}자, 그래도 없음 {1}자: {2}" -f $viaOld.Count, $still.Count, ($still -join "")
foreach ($c in "気","学","国","剥","填","塡") { $c + " → " + (($old[$c] | ForEach-Object { $_ + ":" + ($hun[$_] -join " | ") }) -join " / ") }