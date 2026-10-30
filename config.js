/* Shifokor top settings.
   supabaseUrl / supabaseKey: the Supabase project that stores ratings and reviews (Project Settings → API).
   The "anon public" key is meant to be public; the database only accepts writes through checked functions.
   Leave both empty when the site runs on its own server (server.js). */
window.ST_CONFIG = {
  supabaseUrl: "",
  supabaseKey: ""
};
