/**
 * Check if the 3 ghost alumni rows have any linked members or other refs.
 * Ghosts = DB alumni whose NOSIS is not in Excel AND whose canonical Excel
 * counterpart has the same name.
 */
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const GHOSTS = [
  { ang: 1, nosis: "908383", nama: "Hendra Wirawan", canonical_nosis: "900083" },
  { ang: 13, nosis: "023406", nama: "Dwiandi Susilo", canonical_nosis: "023407" },
  { ang: 28, nosis: "174186", nama: "Rimadhina Noviana Mega", canonical_nosis: "178568" },
];

for (const g of GHOSTS) {
  const { data: alumni } = await supabase
    .from("alumni")
    .select("id, nama, nosis, angkatan")
    .eq("angkatan", g.ang)
    .eq("nosis", g.nosis);
  const { data: canonical } = await supabase
    .from("alumni")
    .select("id, nama, nosis, angkatan")
    .eq("angkatan", g.ang)
    .eq("nosis", g.canonical_nosis);

  const ghostId = alumni?.[0]?.id;
  const canonId = canonical?.[0]?.id;
  if (!ghostId) {
    console.log(`TN${g.ang} NOSIS ${g.nosis}: GHOST NOT FOUND`);
    continue;
  }

  const { count: memberCount } = await supabase
    .from("members")
    .select("id", { count: "exact", head: true })
    .eq("alumni_id", ghostId);

  console.log(
    `TN${g.ang} ghost: ${g.nosis} "${g.nama}" id=${ghostId} | canonical=${canonId || "?"} | members_linked=${memberCount}`
  );

  if (memberCount > 0) {
    const { data: ms } = await supabase
      .from("members")
      .select("id, no, nama")
      .eq("alumni_id", ghostId);
    for (const m of ms || []) console.log(`    member: no=${m.no} nama="${m.nama}" id=${m.id}`);
  }
}
