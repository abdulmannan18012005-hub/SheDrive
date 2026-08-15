# Find the active network route to the internet gateway (the router)
$gatewayRoute = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Select-Object -First 1
$ip = $null

if ($gatewayRoute) {
    # Resolve the IPv4 address assigned to this active network adapter
    $ip = (Get-NetIPAddress -InterfaceIndex $gatewayRoute.InterfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue | Select-Object -First 1).IPAddress
}

# Fallback 1: Search for active Wi-Fi interface by alias
if (-not $ip) {
    $ip = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias 'Wi-Fi' -ErrorAction SilentlyContinue | Select-Object -First 1).IPAddress
}

# Fallback 2: Search for active Ethernet interface by alias
if (-not $ip) {
    $ip = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias 'Ethernet*' -ErrorAction SilentlyContinue | Select-Object -First 1).IPAddress
}

# Fallback 3: Search for any active non-loopback, non-virtual IPv4 address
if (-not $ip) {
    $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
        $_.IPAddress -notlike '127.*' -and 
        $_.IPAddress -notlike '169.254.*' -and 
        $_.InterfaceAlias -notlike '*Virtual*' -and 
        $_.InterfaceAlias -notlike '*Loopback*' -and
        $_.InterfaceAlias -notlike '*vEthernet*' -and
        $_.InterfaceAlias -notlike '*Docker*' -and
        $_.InterfaceAlias -notlike '*WSL*'
    } | Select-Object -First 1).IPAddress
}

if ($ip) {
    Write-Host "Resolved active LAN IP: $ip"
    $env:REACT_NATIVE_PACKAGER_HOSTNAME = $ip
} else {
    Write-Warning "Could not resolve active LAN IP. Falling back to localhost."
}

# Find path to npx on the system for execution compatibility
$npxCmd = Get-Command npx -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
if (-not $npxCmd) {
    $npxCmd = "npx"
}

Write-Host "Launching Expo development server..."
& $npxCmd expo start --clear
