function updateSend() {
  const busy = activeRuns.size > 0;
  $('send').disabled = busy;
  $('send').textContent = busy ? '…' : '↑';
  $('statuslight').classList.toggle('on', busy); // ang violet na ilaw
}
