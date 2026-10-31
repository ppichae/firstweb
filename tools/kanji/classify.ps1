# 987자 한국어 훈음 조사: libhangul · 한국어 위키낱말사전 · KANJIDIC2 · Unihan 대조 후 세 단계로 분류
param([string]$RepoDir, [string]$Scr, [string]$OutFile)
$enc = [Text.Encoding]::UTF8
function U($s) { [char]::ConvertFromUtf32([Convert]::ToInt32(($s -replace "<.*", "").Substring(2), 16)) }
function J($p) { [IO.File]::ReadAllText((Join-Path $RepoDir $p), $enc) | ConvertFrom-Json }
function Chars($words) { $h = [ordered]@{}; foreach ($w in $words) { foreach ($ch in $w.ToCharArray()) { $n = [int]$ch; if ($n -ge 0x4E00 -and $n -le 0x9FFF) { $h["$ch"] = 1 } } }; $h }

# 대상 987자와 급수(이 사이트 단어장 기준)
$n3 = Chars ((J "data/n3/vocab.json").items | ForEach-Object { $_.word })
$n1 = Chars (@((J "data/n1/vocab.json").items | ForEach-Object { $_.word }) + @((J "data/vocabulary.json").items | ForEach-Object { $_.word }))
$target = [ordered]@{}; foreach ($k in $n3.Keys) { $target[$k] = "N3" }; foreach ($k in $n1.Keys) { if (-not $target.Contains($k)) { $target[$k] = "N1" } }

# libhangul: 한 글자 항목(훈음이 비어 있는 항목도 음은 기록)
$lhHun = @{}; $lhEum = @{}
foreach ($line in [IO.File]::ReadLines("$Scr\hun-dl\hanja.txt", $enc)) {
  if ($line.StartsWith("#")) { continue }
  $p = $line.Split(":", 3)
  if ($p.Count -lt 3 -or $p[0].Length -ne 1 -or $p[1].Length -ne 1) { continue }
  $lhEum[$p[1]] = @($lhEum[$p[1]]) + $p[0] | Where-Object { $_ } | Select-Object -Unique
  foreach ($g in $p[2].Split(",")) { $g = $g.Trim(); if ($g) { $lhHun[$p[1]] = @($lhHun[$p[1]]) + $g | Where-Object { $_ } } }
}
# 한국어 위키낱말사전 {{한자풀이}}: 훈·음·신자체
$wkHun = @{}; $wkEum = @{}; $wkShin = @{}
foreach ($line in [IO.File]::ReadLines("$Scr\kowikt-dl\hanja-tpl.tsv", $enc)) {
  $t = $line.Split("`t", 2); if ($t.Count -lt 2 -or $t[0].Length -ne 1) { continue }
  $body = $t[1] -replace '\[\[(?:[^\]|]*\|)?([^\]]*)\]\]', '$1'; $f = @{}; foreach ($m in [regex]::Matches($body, '\|\s*([^=|{}]+?)\s*=\s*([^|}]*)')) { $f[$m.Groups[1].Value] = $m.Groups[2].Value.Trim() }
  $clean = { param($s) @(($s -replace '\[\[([^\]|]*\|)?([^\]]*)\]\]', '$2') -replace '\(?\d+\.\)?', ',' -split '[,，、/・·~]' | ForEach-Object { $_.Trim() } | Where-Object { $_ }) }
  if ($f["훈"]) { $wkHun[$t[0]] = & $clean $f["훈"] }
  if ($f["음"]) { $wkEum[$t[0]] = & $clean $f["음"] }
  if ($f["신자체"]) { foreach ($s in (& $clean $f["신자체"])) { if ($s.Length -eq 1) { $wkShin[$s] = @($wkShin[$s]) + $t[0] | Where-Object { $_ } } } }
}
# Unihan: 이체자 관계와 한국 음(kHangul)
$var = @{}; $uhEum = @{}
foreach ($line in [IO.File]::ReadLines("$Scr\unihan-dl\Unihan_Variants.txt", $enc)) {
  if ($line -match '^U\+(\w+)\t(kJapaneseOldVariant|kTraditionalVariant|kZVariant|kSemanticVariant|kSpecializedSemanticVariant)\t(.+)$') {
    $c = U ("U+" + $Matches[1]); foreach ($v in $Matches[3].Split(" ")) { $vc = U $v; if ($vc -ne $c) { $var[$c] = @($var[$c]) + ($vc + "|" + $Matches[2]) | Where-Object { $_ } } }
  }
}
foreach ($line in [IO.File]::ReadLines("$Scr\unihan-dl\Unihan_Readings.txt", $enc)) {
  if ($line -match '^U\+(\w+)\tkHangul\t(.+)$') { $uhEum[(U ("U+" + $Matches[1]))] = @($Matches[2].Split(" ") | ForEach-Object { ($_ -split ":")[0] }) }
}
# KANJIDIC2 한국 음
$kdEum = @{}
$xs = New-Object Xml.XmlReaderSettings; $xs.DtdProcessing = "Parse"; $xs.XmlResolver = $null; $xs.MaxCharactersFromEntities = 0
$xr = [Xml.XmlReader]::Create("$Scr\kanjidic-dl\kanjidic2.xml", $xs); $cur = ""
while ($xr.Read()) {
  if ($xr.NodeType -ne "Element") { continue }
  if ($xr.Name -eq "literal") { $cur = $xr.ReadElementContentAsString() }
  elseif ($xr.Name -eq "reading" -and $xr.GetAttribute("r_type") -eq "korean_h" -and $target.Contains($cur)) { $kdEum[$cur] = @($kdEum[$cur]) + $xr.ReadElementContentAsString() | Where-Object { $_ } }
}
$xr.Close()

# 위키낱말사전 훈(기본형 '막히다', 명사 '기운')과 libhangul 훈('막힐', '기운')이 같은 말인지
function StemOf($v) { if ($v.EndsWith("다") -and $v.Length -ge 2) { $v.Substring(0, $v.Length - 1) } else { $v } }
function SameHun($lh, $wk) {
  $w = $lh.Trim(); $v = $wk.Trim(); if (-not $w -or -not $v) { return $false }
  if ($w -eq $v) { return $true }
  $st = StemOf $v
  if ($w -eq $st -or ($w -replace " ","") -eq ($v -replace " ","")) { return $true }
  $sl = [int]$st[$st.Length - 1]
  if ($sl -ge 0xAC00 -and $sl -le 0xD7A3) {
    $sf = ($sl - 0xAC00) % 28; $pre = $st.Substring(0, $st.Length - 1)
    if ($sf -eq 17 -and $w -eq ($pre + [char]($sl - 17) + "울")) { return $true }   # ㅂ 불규칙: 무겁다 → 무거울
    if ($sf -eq 7 -and $w -eq ($pre + [char]($sl - 7 + 8) + "을")) { return $true }   # ㄷ 불규칙: 걷다 → 걸을
  }
  if ($w -eq ($st + "을") -or $w -eq ($st + "할") -or $w -eq ($st + "한")) { return $true }
  $last = [int]$w[$w.Length - 1]
  if ($last -ge 0xAC00 -and $last -le 0xD7A3) {
    $fin = ($last - 0xAC00) % 28
    if ($fin -eq 8 -or $fin -eq 4) { $base = $w.Substring(0, $w.Length - 1) + [char]($last - $fin); if ($base -eq $st) { return $true } }  # ㄹ·ㄴ 받침을 떼면 어간
  }
  return $false
}

$rows = @(); $cnt = @{ "1" = 0; "2" = 0; "3" = 0 }
foreach ($c in $target.Keys) {
  # 찾아볼 글자: 원래 글자 → Unihan 이체자 → 위키낱말사전 '신자체' 역참조
  $forms = @(@{ ch = $c; how = "원래 글자" })
  # 일본 신자체가 다른 한자와 모양이 같은 경우(担·証·予 등)가 있어, 일본 구자체(kJapaneseOldVariant)를 원래 글자보다 먼저 찾는다
  $jo = @(@($var[$c]) | Where-Object { $_ -like "*|kJapaneseOldVariant" }); if ($jo.Count) { $forms = @(@{ ch = $jo[0].Split("|")[0]; how = "Unihan kJapaneseOldVariant(일본 구자체)" }) + $forms }
  foreach ($v in @($var[$c])) { if ($v -and $v -notlike "*|kJapaneseOldVariant") { $a = $v.Split("|"); $forms += @{ ch = $a[0]; how = "Unihan " + $a[1] } } }
  $manual = @{ "清" = "淸"; "閲" = "閱"; "剥" = "剝" }   # 영어판 위키낱말사전 {{ja-kanji|kyu=…}} 구자체 표시로 확인
  if ($manual[$c]) { $forms += @{ ch = $manual[$c]; how = "영어판 위키낱말사전 구자체 표시" } }
  foreach ($v in @($wkShin[$c])) { if ($v -and $v -ne $c) { $forms += @{ ch = $v; how = "위키낱말사전 신자체 표시" } } }
  $lhForm = $forms | Where-Object { $lhHun[$_.ch] } | Select-Object -First 1
  $wkForm = $forms | Where-Object { $wkHun[$_.ch] } | Select-Object -First 1
  $lhList = if ($lhForm) { @($lhHun[$lhForm.ch]) } else { @() }
  $wkList = if ($wkForm) { @($wkHun[$wkForm.ch]) } else { @() }
  $eums = [ordered]@{}
  foreach ($fm in $forms) { foreach ($e in @($lhEum[$fm.ch])) { if ($e) { $eums["libhangul"] = @($eums["libhangul"]) + $e | Where-Object { $_ } | Select-Object -Unique } } }
  if ($wkForm) { $eums["위키"] = @($wkEum[$wkForm.ch]) }
  if ($kdEum[$c]) { $eums["KANJIDIC2"] = @($kdEum[$c]) }
  $ue = @(); foreach ($fm in $forms) { $ue += @($uhEum[$fm.ch]) | Where-Object { $_ } }; if ($ue.Count) { $eums["Unihan"] = @($ue | Select-Object -Unique) }
  # 대표 음: libhangul 훈음 끝 글자(예: '막힐 조' → 조) 중 다른 자료가 가장 많이 지지하는 음
  $cand = @{}; foreach ($g in $lhList) { $e = ($g -split " ")[-1]; $cand[$e] = 0 }
  foreach ($e in @($cand.Keys)) { foreach ($s in $eums.Keys) { if ($s -ne "libhangul" -and @($eums[$s]) -contains $e) { $cand[$e]++ } } }
  $match = $null
  foreach ($g in $lhList) { $parts = $g -split " "; $h = ($parts[0..($parts.Count - 2)] -join " "); $e = $parts[-1]; foreach ($wh in $wkList) { if ((SameHun $h $wh) -and (@($wkEum[$wkForm.ch]) -contains $e)) { $match = $g; break } }; if ($match) { break } }
  $support = 0; if ($match) { $me = ($match -split " ")[-1]; foreach ($s in "KANJIDIC2", "Unihan") { if (@($eums[$s]) -contains $me) { $support++ } } }
  if ($match -and $support -ge 1) { $cat = "1"; $rep = $match; $why = "libhangul과 위키낱말사전의 훈·음이 일치하고, 음은 KANJIDIC2·Unihan으로도 확인" }
  elseif ($lhList.Count -or $wkList.Count) {
    $cat = "2"; $rep = ""
    $why = if ($lhList.Count -and $wkList.Count) { "두 자료 모두 훈이 있으나 표현이 달라 자동 일치 판정이 안 됨 → 비교해 선정 필요" } elseif ($lhList.Count) { "libhangul에만 훈이 있음(위키낱말사전 없음)" } else { "위키낱말사전에만 훈이 있음(libhangul은 음만 있음)" }
    $best = ($cand.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 1)
    if ($best -and $best.Value -eq 0) { $why += " · 음이 다른 자료와 맞지 않음" }
  } else { $cat = "3"; $rep = ""; $why = "훈이 있는 자료를 찾지 못함" }
  $cnt[$cat]++
  $rows += [pscustomobject]@{
    char = $c; level = $target[$c]; category = $cat; representative = $rep; reason = $why
    libhangulForm = $(if ($lhForm) { "$($lhForm.ch)($($lhForm.how))" } else { "" }); libhangul = ($lhList -join ", ")
    wiktForm = $(if ($wkForm) { "$($wkForm.ch)($($wkForm.how))" } else { "" }); wiktHun = ($wkList -join ", "); wiktEum = $(if ($wkForm) { @($wkEum[$wkForm.ch]) -join "," } else { "" })
    kanjidic2Eum = (@($eums["KANJIDIC2"]) -join ","); unihanEum = (@($eums["Unihan"]) -join ",")
  }
}
$rows | Export-Csv -Path $OutFile -NoTypeInformation -Encoding UTF8
"전체 {0}자 · 1단계(확인 완료) {1} · 2단계(비교 필요) {2} · 3단계(미확인) {3}" -f $rows.Count, $cnt["1"], $cnt["2"], $cnt["3"]
"2단계 이유별: " + (($rows | Where-Object { $_.category -eq "2" } | Group-Object reason | ForEach-Object { "$($_.Count)자 = $($_.Name)" }) -join " / ")
"3단계: " + (($rows | Where-Object { $_.category -eq "3" } | ForEach-Object { $_.char }) -join "")
