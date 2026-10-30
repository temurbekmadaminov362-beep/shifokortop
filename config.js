/* Shifokor top settings.
   supabaseUrl / supabaseKey: the Supabase project that stores ratings and reviews (Project Settings → API).
   The "anon public" key is meant to be public; the database only accepts writes through checked functions.
   Leave both empty when the site runs on its own server (server.js). */
window.ST_CONFIG = {
  supabaseUrl: "https://mkfdcvmbglmbzrcrmtdk.supabase.co",
  supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rZmRjdm1iZ2xtYnpyY3JtdGRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzMzU1ODksImV4cCI6MjEwODkxMTU4OX0.Edi18KpSfCGORa_VsspXk5-OXTL6Kan0pXML603mqQI"
};
// Telegram bot username without @ (set after the bot is created); used for "share" links inside Telegram.
window.ST_CONFIG.telegramBot = "";
