/* ==================== AIRPORT MAP ==================== */

export const airportMap = {
    PDX: "Portland International Airport, Portland, OR",
    LGB: "Long Beach Airport, Long Beach, CA",
    SNA: "John Wayne Airport (Orange County), Santa Ana, CA",
    ABQ: "Albuquerque International Sunport, Albuquerque, NM",
    FWA: "Fort Wayne International Airport, Fort Wayne, IN",
    LEX: "Blue Grass Airport, Lexington, KY",
    MDW: "Chicago Midway International Airport, Chicago, IL",
    IND: "Indianapolis International Airport, Indianapolis, IN",
    HOU: "William P. Hobby Airport, Houston, TX",
    IAH: "George Bush Intercontinental Airport, Houston, TX",
    PNS: "Pensacola International Airport, Pensacola, FL",
    VPS: "Destin–Fort Walton Beach Airport, Valparaiso, FL",
    GPT: "Gulfport–Biloxi International Airport, Gulfport, MS",
    ECP: "Northwest Florida Beaches International Airport, Panama City, FL",
    CLT: "Charlotte Douglas International Airport, Charlotte, NC",
    DTW: "Detroit Metropolitan Wayne County Airport, Detroit, MI",
    TPA: "Tampa International Airport, Tampa, FL",
    RDU: "Raleigh–Durham International Airport, Raleigh/Durham, NC",
    ORF: "Norfolk International Airport, Norfolk, VA",
    BDL: "Bradley International Airport, Windsor Locks, CT",
    JAX: "Jacksonville International Airport, Jacksonville, FL",
    JAN: "Jackson–Medgar Wiley Evers International Airport, Jackson, MS"
};

/* ==================== HELPERS ==================== */

export const getAirportCode = (value) => {
    if (!value) return "";

    const input = value.trim().toUpperCase();

    // already code
    if (airportMap[input]) return input;

    // match by airport name (partial)
    const match = Object.entries(airportMap).find(([code, name]) =>
        name.toUpperCase().includes(input)
    );

    return match ? match[0] : "";
};

export const getAirportName = (code) => {
    if (!code) return "";
    return airportMap[code] || "";
};
