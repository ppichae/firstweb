# 한자 현황 조사: 단어장에 쓰인 한자 vs 사이트 한자 목록 vs KANJIDIC2(옛 JLPT 급수·학년·한국 한자음)
param([string]$R, [string]$KdFile)
$enc = [Text.Encoding]::UTF8
function J($p) { [IO.File]::ReadAllText((Join-Path $R $p), $enc) | ConvertFrom-Json }
function Chars($words) {
  $h = @{}
  foreach ($w in $words) { foreach ($c in $w.ToCharArray()) { $n = [int]$c; if (($n -ge 0x4E00 -and $n -le 0x9FFF) -or $n -eq 0x3005) { if ($c -ne [char]0x3005) { $h["$c"] = 1 + [int]$h["$c"] } } } }
  $h
}
$n3w = (J "data/n3/vocab.json").items | ForEach-Object { $_.word }
$n1a = J "data/n1/vocab.json"; $n1b = J "data/vocabulary.json"
$n1w = @($n1a.items | ForEach-Object { $_.word }) + @(($n1b.items + $n1b.vocabulary) | Where-Object { $_ } | ForEach-Object { $_.word })
$n3c = Chars $n3w; $n1c = Chars $n1w
$siteN3 = (J "data/kanji/n3.json").kanji; $siteN1 = (J "data/kanji/n1.json").kanji
$common = J "data/kanji/common.json"
$detail = @{}; foreach ($k in ($common.kanji + $common.items) | Where-Object { $_ }) { $detail[$k.char] = $k }

# KANJIDIC2: 한자별 옛 JLPT 급수, 학년(1~6 교육, 8 상용, 9·10 인명용), 한국 한자음
$kd = @{}
$xs = New-Object Xml.XmlReaderSettings; $xs.DtdProcessing = "Parse"; $xs.XmlResolver = $null; $xs.MaxCharactersFromEntities = 0; $xr = [Xml.XmlReader]::Create($KdFile, $xs)
$cur = $null
while ($xr.Read()) {
  if ($xr.NodeType -ne "Element") { continue }
  switch ($xr.Name) {
    "literal" { $cur = @{ jlpt = 0; grade = 0; kh = @(); freq = 0 }; $kd[$xr.ReadElementContentAsString()] = $cur }
    "jlpt" { $cur.jlpt = [int]$xr.ReadElementContentAsString() }
    "grade" { $cur.grade = [int]$xr.ReadElementContentAsString() }
    "freq" { $cur.freq = [int]$xr.ReadElementContentAsString() }
    "reading" { if ($xr.GetAttribute("r_type") -eq "korean_h") { $cur.kh += $xr.ReadElementContentAsString() } }
  }
}
$xr.Close()
$kvg = @{}; Get-ChildItem (Join-Path $R "data/kanjivg") -Filter *.svg | ForEach-Object { $kvg["" + [char][Convert]::ToInt32(($_.BaseName -replace "-.*",""), 16)] = 1 }

function Desc($name, $set) {
  $ks = @($set.Keys)
  $joyo = @($ks | Where-Object { $kd[$_] -and $kd[$_].grade -ge 1 -and $kd[$_].grade -le 8 }).Count
  $kh = @($ks | Where-Object { $kd[$_] -and $kd[$_].kh.Count -gt 0 }).Count
  $lv = @{}; foreach ($k in $ks) { $l = if ($kd[$k]) { $kd[$k].jlpt } else { -1 }; $lv[$l] = 1 + [int]$lv[$l] }
  "{0}: 한자 {1}자 · 상용한자 {2} · 한국 한자음 있음 {3} · 옛 JLPT 급수 분포 {4}" -f $name, $ks.Count, $joyo, $kh, (($lv.GetEnumerator() | Sort-Object Name | ForEach-Object { "L$($_.Name)=$($_.Value)" }) -join " ")
}
"사이트 한자 목록: N3 {0}자, N1 {1}자, 상세 자료 {2}자, 획순 SVG {3}개" -f $siteN3.Count, $siteN1.Count, $detail.Count, $kvg.Count
"겹침(N1·N3 둘 다): " + (@($siteN1 | Where-Object { $siteN3 -contains $_ }) -join "")
"N1 목록 중 쉬운 한자(옛 급수 3·4 = N4·N5 수준): " + (@($siteN1 | Where-Object { $kd[$_] -and $kd[$_].jlpt -ge 3 }) -join "")
"N3 목록 중 어려운 한자(옛 1급): " + (@($siteN3 | Where-Object { $kd[$_] -and $kd[$_].jlpt -eq 1 }) -join "")
Desc "N3 단어장에 쓰인 한자" $n3c
Desc "N1 단어장에 쓰인 한자" $n1c
$only1 = @{}; foreach ($k in $n1c.Keys) { if (-not $n3c.ContainsKey($k)) { $only1[$k] = 1 } }
Desc "N1에만 쓰인 한자" $only1
$all = @{}; foreach ($k in $n3c.Keys + $n1c.Keys) { $all[$k] = 1 }
Desc "두 단어장 합계" $all
"합계 중 상세 자료 없음: " + @($all.Keys | Where-Object { -not $detail.ContainsKey($_) }).Count
"합계 중 획순 SVG 없음: " + @($all.Keys | Where-Object { -not $kvg.ContainsKey($_) }).Count
"합계 중 상용한자 아님: " + (@($all.Keys | Where-Object { -not ($kd[$_] -and $kd[$_].grade -ge 1 -and $kd[$_].grade -le 8) }) -join "")
"KANJIDIC2 전체 옛 JLPT 급수 수: " + ((1..4 | ForEach-Object { $l = $_; "L$l=" + @($kd.Values | Where-Object { $_.jlpt -eq $l }).Count }) -join " ")
"KANJIDIC2 상용한자 수: " + @($kd.Values | Where-Object { $_.grade -ge 1 -and $_.grade -le 8 }).Count + " · 그중 한국 한자음 있음: " + @($kd.Values | Where-Object { $_.grade -ge 1 -and $_.grade -le 8 -and $_.kh.Count -gt 0 }).Count
"상세 자료 70자 중 KANJIDIC2 한국 한자음과 음이 다른 것: " + (@($detail.Values | Where-Object { $kd[$_.char] -and $_.ko -and $_.ko.eum -and -not ($kd[$_.char].kh -contains $_.ko.eum) } | ForEach-Object { $_.char + "(" + $_.ko.eum + "/" + ($kd[$_.char].kh -join ",") + ")" }) -join " ")
