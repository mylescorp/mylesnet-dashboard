param(
  [switch]$Once
)

$collectorSecret = (npx convex env get MYLESNET_COLLECTOR_SHARED_SECRET --prod 2>$null | Out-String).Trim()
if ([string]::IsNullOrWhiteSpace($collectorSecret)) {
  Write-Error "The production collector signing secret is unavailable."
  exit 1
}

$env:MYLESNET_COLLECTOR_SHARED_SECRET = $collectorSecret
$nodeArguments = @("--env-file=collector/.env.local", "collector/forwarder.mjs")
if ($Once) {
  $nodeArguments += "--once"
}

& node @nodeArguments
$exitCode = $LASTEXITCODE
Remove-Item Env:MYLESNET_COLLECTOR_SHARED_SECRET -ErrorAction SilentlyContinue
exit $exitCode
