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
}

export const resolveLocation = (location) => {
    if (!location) return "";

    const code = location.trim().toUpperCase();

    if (/^[A-Z]{3}$/.test(code)) {
        return airportMap[code] || location;
    }

    return location;
};

export const normalizeToCode = (value) => {
    if (!value) return value;

    const upper = value.trim().toUpperCase();

    // if already a code
    if (/^[A-Z]{3}$/.test(upper)) return upper;

    // try to find matching airport
    const match = Object.entries(airportMap).find(
        ([code, name]) => name === value
    );

    return match ? match[0] : value;
};

export const formatLocationWithFlight = (location, flightNumber) => {
    if (!location) return "";

    const isAirport = /^[A-Z]{3}$/.test(location);

    return isAirport && flightNumber
        ? `${location} ${flightNumber}`
        : location;
};