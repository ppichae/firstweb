# 예문 자동 검사: 읽기 붙이기 누락, 단어 포함 여부, 한자 읽기(JMdict 단어 쌍 → KANJIDIC2 한자별 읽기), 중복
# 검사가 끝나면 각 예문에 reading(히라가나 전체 읽기)과 check(검사 결과)를 써 넣는다.
param([string]$Ex, [string]$Src, [string]$Pairs, [string]$Kd, [switch]$Grammar)
$ErrorActionPreference = "Stop"
$utf8 = New-Object Text.UTF8Encoding $false
$pairSet = New-Object 'System.Collections.Generic.HashSet[string]'
$headSet = New-Object 'System.Collections.Generic.HashSet[string]'   # 사전에 표제어로 있는 한자 표기
foreach ($l in [IO.File]::ReadLines($Pairs, [Text.Encoding]::UTF8)) { [void]$pairSet.Add($l); [void]$headSet.Add($l.Split("`t")[0]) }
$kdMap = @{}
foreach ($l in [IO.File]::ReadLines($Kd, [Text.Encoding]::UTF8)) { $p = $l.Split("`t"); if ($p.Count -eq 2) { $kdMap[$p[0]] = $p[1].Split(",") } }
$srcMap = @{}; ([IO.File]::ReadAllText($Src, [Text.Encoding]::UTF8) | ConvertFrom-Json).items | ForEach-Object { $srcMap[$_.id] = $_ }
$doc = [IO.File]::ReadAllText($Ex, [Text.Encoding]::UTF8) | ConvertFrom-Json

$VOICE = @{ "か"="が";"き"="ぎ";"く"="ぐ";"け"="げ";"こ"="ご";"さ"="ざ";"し"="じ";"す"="ず";"せ"="ぜ";"そ"="ぞ";"た"="だ";"ち"="ぢ";"つ"="づ";"て"="で";"と"="ど";"は"="ばぱ";"ひ"="びぴ";"ふ"="ぶぷ";"へ"="べぺ";"ほ"="ぼぽ" }
function Cands([string]$c) {
  $out = New-Object 'System.Collections.Generic.HashSet[string]'
  foreach ($r in $kdMap[$c]) {
    if (-not $r) { continue }
    [void]$out.Add($r)
    $f = $r.Substring(0, 1); if ($VOICE.ContainsKey($f)) { foreach ($v in $VOICE[$f].ToCharArray()) { [void]$out.Add([string]$v + $r.Substring(1)) } }
    if ($r.Length -gt 1 -and "くつちき".Contains($r.Substring($r.Length - 1))) { [void]$out.Add($r.Substring(0, $r.Length - 1) + "っ") }
  }
  return $out
}
# 한자열 k를 읽기 r로 나눌 수 있는가 (々는 앞 글자 반복)
function Seg([string]$k, [string]$r) {
  if ($k.Length -eq 0) { return $r.Length -eq 0 }
  $c = $k.Substring(0, 1)
  if ($c -eq "々") { return $false }
  foreach ($x in (Cands $c)) { if ($r.StartsWith($x) -and (Seg $k.Substring(1) $r.Substring($x.Length))) { return $true } }
  return $false
}
$isKanji = '[一-鿿々]'
$seen = @{}; $rows = @(); $flagN = 0
foreach ($it in $doc.items) {
  $flags = @()
  $runs = [regex]::Matches($it.ja, '\{([^|}]+)\|([^}]+)\}')
  $plain = [regex]::Replace($it.ja, '\{([^|}]+)\|([^}]+)\}', '$1')
  $reading = [regex]::Replace($it.ja, '\{([^|}]+)\|([^}]+)\}', '$2')
  # 1) 읽기를 붙이지 않은 한자
  $bare = [regex]::Replace($it.ja, '\{[^}]+\}', '')
  if ($bare -match $isKanji) { $flags += "읽기 없는 한자: " + (([regex]::Matches($bare, $isKanji) | ForEach-Object Value) -join "") }
  # 2) 단어·문형이 문장에 들어 있는가
  $t = $srcMap[$it.target]
  if (-not $t) { $flags += "대상 id 없음" }
  else {
    $head = if ($t.word) { $t.word } else { $t.pattern }
    $keys = @($head -replace '^[～〜]', '' -replace '[～〜].*$', '')
    if ($t.pos -eq "verb" -or $t.pos -eq "i-adj") { $keys += $head.Substring(0, $head.Length - 1) }
    if ($t.reading) { $keys += $t.reading }
    if ($Grammar) { $keys = @($keys | ForEach-Object { ($_ -split '[（(／/]')[0].Trim() }) }
    $hit = $false; foreach ($kk in $keys) { if ($kk -and ($plain.Contains($kk) -or $reading.Contains($kk))) { $hit = $true } }
    if (-not $hit) { $flags += "대상 표현이 문장에 없음(" + $head + ")" }
  }
  # 3) 한자 읽기 확인
  $okRuns = 0
  foreach ($m in $runs) {
    $k = $m.Groups[1].Value; $r = $m.Groups[2].Value
    # 사전에 표제어로 있는 한자 묶음이면 사전 읽기와 정확히 같아야 하고, 없을 때만 한자별 읽기로 맞춰 본다
    # 바로 뒤에 붙은 오쿠리가나(가나)까지 합쳐서 사전 표제어와 맞춰 본다 (예: {手洗|てあら}い = 手洗 てあらい)
    $after = $it.ja.Substring($m.Index + $m.Length); $tail = ([regex]::Match($after, '^[\u3041-\u3096]{1,4}')).Value
    $okTail = $false; for ($n = 1; $n -le $tail.Length; $n++) { if ($pairSet.Contains("$k`t$r" + $tail.Substring(0, $n))) { $okTail = $true } }
    if ($pairSet.Contains("$k`t$r") -or $okTail) { $okRuns++ }
    elseif ($k.Length -ge 2 -and $headSet.Contains($k)) { $flags += "사전 읽기와 다름: " + $k + "=" + $r }
    elseif (Seg $k $r) { $okRuns++ } else { $flags += "읽기 확인 못함: " + $k + "=" + $r }
  }
  # 4) 중복
  if ($seen.ContainsKey($plain)) { $flags += "같은 예문 중복" } else { $seen[$plain] = 1 }
  $it | Add-Member -NotePropertyName reading -NotePropertyValue $reading -Force
  $it | Add-Member -NotePropertyName check -NotePropertyValue ([ordered]@{ readings = "$okRuns/$($runs.Count)"; target = -not ($flags -match "대상"); flags = $flags; at = "2026-10-31" }) -Force
  $it | Add-Member -NotePropertyName review -NotePropertyValue "self_reviewed" -Force
  if ($flags.Count) { $flagN++; $rows += $it.target + " : " + ($flags -join " / ") }
}
# 항목을 한 줄씩 보기 좋게 저장 (meta는 그대로)
$lines = $doc.items | ForEach-Object { "    " + ($_ | ConvertTo-Json -Compress -Depth 5) }
$out = "{`n  `"meta`": " + ($doc.meta | ConvertTo-Json -Compress -Depth 5) + ",`n  `"items`": [`n" + ($lines -join ",`n") + "`n  ]`n}`n"
[IO.File]::WriteAllText($Ex, $out, $utf8)
"예문 " + $doc.items.Count + "개 · 문제 있는 예문 " + $flagN + "개"
$rows