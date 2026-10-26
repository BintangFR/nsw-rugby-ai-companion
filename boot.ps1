# One-click start for Tackle AI (run via boot.cmd). Everything this script starts (Node, Ollama and any
# model runners Ollama spawns) is placed in a Windows job object that is killed when this window closes,
# however it closes: X button, Ctrl+C or a crash. An Ollama that was already running is left alone.
param([int]$Port = $(if ($env:PORT) { [int]$env:PORT } else { 5173 }))
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class TackleJob {
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern IntPtr CreateJobObject(IntPtr attrs, string name);
  [DllImport("kernel32.dll")] static extern bool SetInformationJobObject(IntPtr job, int cls, IntPtr info, uint len);
  [DllImport("kernel32.dll")] static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
  [StructLayout(LayoutKind.Sequential)] struct Basic { public long UserTime; public long JobTime; public uint LimitFlags; public UIntPtr MinWs; public UIntPtr MaxWs; public uint ActiveLimit; public UIntPtr Affinity; public uint Priority; public uint Scheduling; }
  [StructLayout(LayoutKind.Sequential)] struct Io { public ulong A, B, C, D, E, F; }
  [StructLayout(LayoutKind.Sequential)] struct Extended { public Basic Basic; public Io Io; public UIntPtr ProcMem, JobMem, PeakProc, PeakJob; }
  static IntPtr job;
  public static void Init() {
    job = CreateJobObject(IntPtr.Zero, null);
    var info = new Extended();
    info.Basic.LimitFlags = 0x2000; // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
    int len = Marshal.SizeOf(typeof(Extended));
    IntPtr ptr = Marshal.AllocHGlobal(len);
    Marshal.StructureToPtr(info, ptr, false);
    if (!SetInformationJobObject(job, 9, ptr, (uint)len)) throw new Exception("Could not create the process job");
  }
  public static void Add(IntPtr process) { if (!AssignProcessToJobObject(job, process)) throw new Exception("Could not attach process to the job"); }
}
'@
[TackleJob]::Init()

function Test-Port([int]$p) {
  $c = New-Object Net.Sockets.TcpClient
  try { $c.Connect('127.0.0.1', $p); $true } catch { $false } finally { $c.Close() }
}

# Ollama: start it only if it is installed and not already serving on its default port.
$ollama = Get-Command ollama -ErrorAction SilentlyContinue
if (-not $ollama) {
  Write-Host 'Ollama not found - AI features will be unavailable. Install from https://ollama.com'
} elseif (Test-Port 11434) {
  Write-Host 'Ollama is already running - leaving it as it is.'
} else {
  Write-Host 'Starting Ollama...'
  $o = Start-Process $ollama.Source -ArgumentList 'serve' -WindowStyle Hidden -PassThru
  [TackleJob]::Add($o.Handle)
}

$url = "http://localhost:$Port"
$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
  Write-Host "Starting Tackle AI at $url  (close this window to stop everything)"
  $env:PORT = "$Port"
  $s = Start-Process $node.Source -ArgumentList 'server.js' -NoNewWindow -PassThru
  [TackleJob]::Add($s.Handle)
  # Open the browser once the server answers (the browser itself is not part of the job).
  for ($i = 0; $i -lt 40 -and -not (Test-Port $Port) -and -not $s.HasExited; $i++) { Start-Sleep -Milliseconds 250 }
  if (-not $s.HasExited) { Start-Process $url }
  $s.WaitForExit()
} else {
  Write-Host 'Node not found - starting the basic static server instead (no saving to data-store).'
  Write-Host 'Install Node for the full app: winget install OpenJS.NodeJS.LTS'
  & "$PSScriptRoot\serve.ps1" -Port $Port   # runs in this window, so it stops with it
}
