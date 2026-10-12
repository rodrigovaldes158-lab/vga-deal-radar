param([string]$Path, [string]$Out)
$bytes = [System.IO.File]::ReadAllBytes($Path)
$enc = [System.Text.Encoding]::GetEncoding(28591)
$s = $enc.GetString($bytes)
$BS = [char]92

function Unescape([string]$t) {
  $bs = [char]92
  $sb = New-Object System.Text.StringBuilder
  for ($i=0; $i -lt $t.Length; $i++) {
    if ($t[$i] -eq $bs) {
      $i++
      if ($i -ge $t.Length) { break }
      $c = $t[$i]
      if ($c -ge '0' -and $c -le '7') {
        $oct = ''
        while ($i -lt $t.Length -and $t[$i] -ge '0' -and $t[$i] -le '7' -and $oct.Length -lt 3) { $oct += $t[$i]; $i++ }
        $i--
        $null = $sb.Append([char][Convert]::ToInt32($oct,8))
      }
      elseif ($c -eq 'n') { $null = $sb.Append(' ') }
      elseif ($c -eq 'r') { $null = $sb.Append(' ') }
      elseif ($c -eq 't') { $null = $sb.Append(' ') }
      else { $null = $sb.Append($c) }
    } else { $null = $sb.Append($t[$i]) }
  }
  $sb.ToString()
}

# Built piecewise so no literal backslash-escaping ambiguity survives the shell.
$D = '-?[0-9.]+'
$W = '[ \t\r\n]+'
$ESC = '(?:' + $BS + $BS + '.|[^)' + $BS + $BS + '])'
$ESCA = '(?:' + $BS + $BS + '.|[^\]' + $BS + $BS + '])'
$pat = '(?s)(?<nums>(?:' + $D + $W + '){6})Tm' +
       '|(?<n2>(?:' + $D + $W + '){2})(?<op>TD|Td)' +
       '|(?<star>T\*)' +
       '|\((?<tj>' + $ESC + '*)\)[ \t\r\n]*Tj' +
       '|\[(?<arr>' + $ESCA + '*)\][ \t\r\n]*TJ'
$rx = New-Object System.Text.RegularExpressions.Regex $pat
$rxStr = New-Object System.Text.RegularExpressions.Regex ('\((?<s>' + $ESC + '*)\)')

$rows = New-Object System.Collections.Generic.List[string]
$pos = 0; $page = 0; $cand = 0; $fail = 0
while ($true) {
  $i = $s.IndexOf("stream", $pos)
  if ($i -lt 0) { break }
  if ($i -ge 3 -and $s.Substring($i-3,3) -eq "end") { $pos = $i + 6; continue }
  $j = $i + 6
  if ($j -lt $s.Length -and $s[$j] -eq [char]13) { $j++ }
  if ($j -lt $s.Length -and $s[$j] -eq [char]10) { $j++ }
  $k = $s.IndexOf("endstream", $j)
  if ($k -lt 0) { break }
  $len = $k - $j
  $content = $null
  $cand++
  if ($len -gt 4) {
    foreach ($skip in 2,0,1) {
      if ($null -ne $content) { break }
      try {
        $sub = New-Object byte[] ($len-$skip)
        [Array]::Copy($bytes, $j+$skip, $sub, 0, $len-$skip)
        $ms = New-Object System.IO.MemoryStream(,$sub)
        $ds = New-Object System.IO.Compression.DeflateStream($ms, [System.IO.Compression.CompressionMode]::Decompress)
        $sr = New-Object System.IO.StreamReader($ds, $enc)
        $t2 = $sr.ReadToEnd(); $sr.Close()
        if ($t2.Length -gt 0) { $content = $t2 }
      } catch { }
    }
  }
  if ($null -eq $content) { $fail++ }
  $pos = $k + 9
  if ($null -eq $content) { continue }
  if ($content.IndexOf('Tj') -lt 0 -and $content.IndexOf('TJ') -lt 0) { continue }
  $page++
  $x=0.0; $y=0.0; $lx=0.0; $ly=0.0
  foreach ($m in $rx.Matches($content)) {
    if ($m.Groups['nums'].Success) {
      $p = @($m.Groups['nums'].Value -split '[ \t\r\n]+' | Where-Object { $_ -ne '' })
      $x = [double]$p[4]; $y = [double]$p[5]; $lx = $x; $ly = $y
    } elseif ($m.Groups['n2'].Success) {
      $p = @($m.Groups['n2'].Value -split '[ \t\r\n]+' | Where-Object { $_ -ne '' })
      $lx = $lx + [double]$p[0]; $ly = $ly + [double]$p[1]; $x = $lx; $y = $ly
    } elseif ($m.Groups['star'].Success) {
      $ly = $ly - 12; $x = $lx; $y = $ly
    } elseif ($m.Groups['tj'].Success) {
      $t = Unescape $m.Groups['tj'].Value
      if ($t.Trim() -ne '') { $rows.Add([string]::Format([System.Globalization.CultureInfo]::InvariantCulture,"{0}	{1:F1}	{2:F1}	{3}",$page,$y,$x,$t)) }
    } elseif ($m.Groups['arr'].Success) {
      $acc = ''
      foreach ($sm in $rxStr.Matches($m.Groups['arr'].Value)) { $acc += (Unescape $sm.Groups['s'].Value) }
      if ($acc.Trim() -ne '') { $rows.Add([string]::Format([System.Globalization.CultureInfo]::InvariantCulture,"{0}	{1:F1}	{2:F1}	{3}",$page,$y,$x,$acc)) }
    }
  }
}
[System.IO.File]::WriteAllLines($Out, $rows, (New-Object System.Text.UTF8Encoding $false))
"$([System.IO.Path]::GetFileName($Path)): $($rows.Count) fragmentos, $page bloques de texto, $cand streams, $fail fallaron"
