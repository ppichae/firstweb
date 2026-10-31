# KANJIDIC2에서 한자별 읽기(음독은 히라가나로, 훈독은 오쿠리가나를 뺀 어간과 전체)를 뽑아 검사용 표를 만든다 (사이트에 넣지 않음)
param([string]$Xml, [string]$Out)
$text = [IO.File]::ReadAllText($Xml, [Text.Encoding]::UTF8)
$sb = New-Object Text.StringBuilder
foreach ($m in [regex]::Matches($text, "<character>\s*<literal>(.+?)</literal>(.*?)</character>", "Singleline")) {
  $c = $m.Groups[1].Value; $blk = $m.Groups[2].Value
  $set = New-Object 'System.Collections.Generic.HashSet[string]'
  foreach ($r in [regex]::Matches($blk, '<reading r_type="ja_on">([^<]+)</reading>')) {
    $h = -join ($r.Groups[1].Value.ToCharArray() | ForEach-Object { $i = [int]$_; if ($i -ge 0x30A1 -and $i -le 0x30F6) { [char]($i - 0x60) } else { $_ } }); [void]$set.Add($h.Replace("-", ""))
  }
  foreach ($r in [regex]::Matches($blk, '<reading r_type="ja_kun">([^<]+)</reading>')) {
    $k = $r.Groups[1].Value.Replace("-", ""); $parts = $k.Split("."); [void]$set.Add($parts[0]); [void]$set.Add($k.Replace(".", ""))
  }
  foreach ($r in [regex]::Matches($blk, '<nanori>([^<]+)</nanori>')) { }
  [void]$sb.Append($c + "`t" + (($set | Where-Object { $_ }) -join ",") + "`n")
}
[IO.File]::WriteAllText($Out, $sb.ToString(), (New-Object Text.UTF8Encoding $false))
"한자 " + ($sb.ToString().Split("`n").Count - 1) + "자"