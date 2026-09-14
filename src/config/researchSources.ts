import { categories, identifierTypes, type ResearchSource } from "../types";
export const categoryLabels: Record<string, string> = {
  PSE: "People Search Engines",
  SEARCH: "OSINT / Identity Discovery",
  "1ST SM": "First Social / Initial Social Sources",
  "TOP SOCMED": "Top Social Media",
  "SUB SOC": "Secondary Social / Niche Sources",
  ARREST: "Arrest / Public Record Sources",
  GSR: "General Search",
};
const directory: Record<(typeof categories)[number], string[]> = {
  PSE: [
    "MyLife|mylife.com",
    "411|411.com",
    "Whitepages|whitepages.com",
    "Radaris|radaris.com",
    "Spokeo|spokeo.com",
    "TruePeopleSearch|truepeoplesearch.com",
    "SearchPeopleFree|searchpeoplefree.com",
    "FastBackgroundCheck|fastbackgroundcheck.com",
    "FastPeopleSearch|fastpeoplesearch.com",
    "Florida Residents Directory|floridaresidentsdirectory.com",
    "Ohio Residents Database|ohioresidentdatabase.com",
    "California Birth Index|californiabirthindex.org",
    "Intelius|intelius.com",
    "TruthFinder|truthfinder.com",
  ],
  SEARCH: [
    "IDCrawl|idcrawl.com",
    "WhatsMyName|whatsmyname.app",
    "RocketReach|rocketreach.co",
    "Epieos|epieos.com",
    "Aware Online Instagram Search|aware-online.com/en/osint-tools/instagram-search-tool/",
    "Google Review Date Finder|www.reviewflowz.com/free-tools/google-review-date-finder",
  ],
  "1ST SM": [
    "Facebook|facebook.com",
    "LinkedIn|linkedin.com",
    "Classmates|classmates.com",
    "Mugshots.com|mugshots.com",
  ],
  "TOP SOCMED": [
    "Instagram|instagram.com",
    "X|x.com",
    "YouTube|youtube.com",
    "TikTok|tiktok.com",
    "Pinterest|pinterest.com",
    "Strava|strava.com",
    "Tumblr|tumblr.com",
    "Threads|threads.com",
    "Foursquare|foursquare.com",
  ],
  "SUB SOC": [
    "Poshmark|poshmark.com",
    "SoundCloud|soundcloud.com",
    "Myspace|myspace.com",
    "Quora|quora.com",
    "ZoomInfo|zoominfo.com",
    "VSCO|vsco.co",
    "Etsy|etsy.com",
    "Reddit|reddit.com",
    "eBay|ebay.com",
    "Yelp|yelp.com",
    "Amazon|amazon.com",
    "Vimeo|vimeo.com",
    "Venmo|venmo.com",
    "Spotify|open.spotify.com",
    "Bluesky|bsky.app",
    "Truth Social|truthsocial.com",
    "Cash App|cash.app",
  ],
  ARREST: [
    "MugshotSearch|mugshotsearch.net",
    "JailBase|jailbase.com",
    "Recently Booked|recentlybooked.com",
    "Arrests.org|arrests.org",
    "Mugshots Zone|mugshots.zone",
    "Arrests.org Face Search|arrests.org",
    "Local Crime News|localcrimenews.com",
  ],
  GSR: [
    "Google|www.google.com",
    "Bing|www.bing.com",
    "DuckDuckGo|duckduckgo.com",
  ],
};
export const sourceId = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-$/, "");
export const defaultSources: ResearchSource[] = categories.flatMap((category) =>
  directory[category].map((entry) => {
    const [name, host] = entry.split("|");
    const id = sourceId(name);
    const templates: Record<string, string> = {
      google: "https://www.google.com/search?q={query}",
      bing: "https://www.bing.com/search?q={query}",
      duckduckgo: "https://duckduckgo.com/?q={query}",
    };
    const searchEngineDiscovery = ["1ST SM", "TOP SOCMED", "SUB SOC"].includes(
      category,
    );
    const interaction: ResearchSource["interaction"] = templates[id]
      ? "direct"
      : searchEngineDiscovery
        ? "search-engine-site-query"
        : "manual";
    const highPriority = [
      "google",
      "bing",
      "duckduckgo",
      "facebook",
      "linkedin",
      "instagram",
      "x",
      "tiktok",
      "reddit",
      "youtube",
      "whitepages",
      "truepeoplesearch",
      "idcrawl",
      "whatsmyname",
      "epieos",
    ];
    return {
      id,
      name,
      category,
      homepage: `https://${host}`,
      strategy: templates[id] ? "template" : "homepage",
      template: templates[id] || "",
      interaction,
      directTemplate: templates[id] || "",
      priority: highPriority.includes(id) ? 15 : category === "ARREST" ? 55 : 35,
      requiresLogin: [
        "facebook",
        "linkedin",
        "instagram",
        "x",
        "tiktok",
        "venmo",
        "spotify",
      ].includes(id),
      potentiallyBlocked:
        category === "ARREST" ||
        ["whitepages", "spokeo", "radaris", "intelius", "truthfinder"].includes(id),
      supportedIdentifiers:
        id === "whatsmyname"
          ? ["username"]
          : id === "epieos"
            ? ["email", "phone"]
            : id === "google-review-date-finder"
              ? ["website"]
              : category === "GSR" ||
                  category === "SUB SOC" ||
                  category === "TOP SOCMED"
                ? [...identifierTypes]
                : [
                    "name",
                    "alias",
                    "username",
                    "email",
                    "phone",
                    "city",
                    "address",
                    "previous_location",
                    "employer",
                  ],
      enabled: true,
      notes:
        category === "ARREST"
          ? "Leads require independent verification. A shared name does not establish a record association."
          : templates[id]
            ? "Opens a search results page."
            : "Opens the source homepage. Enter the identifier manually; sign-in may be required.",
    };
  }),
);
export function recognizeSource(url: string, sources: ResearchSource[]) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return sources.find((s) => {
      const h = new URL(s.homepage).hostname.replace(/^www\./, "");
      return host === h || host.endsWith("." + h);
    });
  } catch {
    return undefined;
  }
}
