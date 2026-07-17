Add-Type -AssemblyName System.Drawing
$assets = @('bank.png', 'games.png', 'farmer_npc.png', 'blacksmith.png', 'shop.png', 'gem_trader.png', 'marketplace.png', 'house_barn_small.png', 'house_farmer_2.png', 'house_stable.png', 'house_oven.png')
foreach ($asset in $assets) {
    $path = Join-Path 'client\public\assets' $asset
    if (Test-Path $path) {
        $img = [System.Drawing.Image]::FromFile($path)
        Write-Output "$asset : $($img.Width) x $($img.Height)"
        $img.Dispose()
    }
}
