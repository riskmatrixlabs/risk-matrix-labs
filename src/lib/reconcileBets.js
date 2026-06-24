// Delete-aware reconciliation of cloud bets with this device's localStorage bets.
//
// THE BUG THIS FIXES: the old startup merge treated *any* local bet absent from the
// cloud as an "orphan to restore" and re-upserted it. After a bet is deleted on another
// device, it is — by definition — "local but not in cloud", so it would resurrect and
// re-upload (the $11k phantom-balance / "reset doesn't stick" class of bug).
//
// Tombstones (client_ids known to have been deleted, stored in the cloud `deleted_bets`
// table so every device learns of the deletion) let us tell the two cases apart:
//   - local-only AND tombstoned  → genuinely deleted → DROP it
//   - local-only AND not tombstoned → genuine offline-created bet → keep + up-sync
//
// Cloud is always authoritative: if a row is present in the cloud it shows, even if its
// id also appears in the tombstone set (a re-created id wins).
export function reconcileBets(cloudBets = [], localBets = [], tombstoneIds = []) {
  const cloudIds = new Set(cloudBets.map(b => String(b.id)))
  const dead     = new Set((tombstoneIds || []).map(String))

  const orphans = localBets.filter(b => {
    const id = String(b.id)
    return !cloudIds.has(id) && !dead.has(id)   // not in cloud AND not deleted
  })

  return { bets: [...cloudBets, ...orphans], orphans }
}
