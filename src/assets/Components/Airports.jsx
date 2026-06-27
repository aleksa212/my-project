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

/* ==================== AREA LOCATIONS ====================
   Each key is an airport code (Area).
   Each array entry is { value, label } where:
     - value = what gets stored in PUlocation / DOlocation
     - label = what the user sees in the dropdown

   Add/remove hotel entries freely — just follow the same format.
======================================================== */

export const areaLocations = {
    PDX: [
        { value: "PDX", label: "PDX – Portland International Airport" },
        { value: "Portland Marriott Downtown Waterfront, 1401 SW Naito Pkwy, Portland, OR 97201", label: "Portland Marriott Downtown Waterfront" },
        { value: "The Nines Hotel, 525 SW Morrison St, Portland, OR 97204", label: "The Nines Hotel" },
        { value: "Hilton Portland Downtown, 921 SW 6th Ave, Portland, OR 97204", label: "Hilton Portland Downtown" },
    ],
    LGB: [
        { value: "LGB", label: "LGB – Long Beach Airport" },
        { value: "Hyatt Regency Long Beach, 200 S Pine Ave, Long Beach, CA 90802", label: "Hyatt Regency Long Beach" },
        { value: "Hotel Maya, 700 Queensway Dr, Long Beach, CA 90802", label: "Hotel Maya" },
        { value: "Renaissance Long Beach Hotel, 111 E Ocean Blvd, Long Beach, CA 90802", label: "Renaissance Long Beach Hotel" },
    ],
    SNA: [
        { value: "SNA", label: "SNA – John Wayne Airport (Orange County)" },
        { value: "Marriott Irvine Spectrum, 7905 Irvine Center Dr, Irvine, CA 92618", label: "Marriott Irvine Spectrum" },
        { value: "Hotel Irvine, 17900 Jamboree Rd, Irvine, CA 92614", label: "Hotel Irvine" },
        { value: "Balboa Bay Resort, 1221 W Coast Hwy, Newport Beach, CA 92663", label: "Balboa Bay Resort" },
    ],
    ABQ: [
        { value: "ABQ", label: "ABQ – Albuquerque International Sunport" },
        { value: "Marriott Albuquerque, 2101 Louisiana Blvd NE, Albuquerque, NM 87110", label: "Marriott Albuquerque" },
        { value: "Hyatt Regency Albuquerque, 330 Tijeras Ave NW, Albuquerque, NM 87102", label: "Hyatt Regency Albuquerque" },
        { value: "Hotel Andaluz, 125 2nd St NW, Albuquerque, NM 87102", label: "Hotel Andaluz" },
    ],
    FWA: [
        { value: "FWA", label: "FWA – Fort Wayne International Airport" },
        { value: "Marriott Fort Wayne, 305 E Washington Blvd, Fort Wayne, IN 46802", label: "Marriott Fort Wayne" },
        { value: "Hilton Fort Wayne at the Grand Wayne Convention Center, 1020 S Calhoun St, Fort Wayne, IN 46802", label: "Hilton Fort Wayne" },
        { value: "Hampton Inn Fort Wayne, 1809 Coliseum Blvd W, Fort Wayne, IN 46808", label: "Hampton Inn Fort Wayne" },
    ],
    LEX: [
        { value: "LEX", label: "LEX – Blue Grass Airport, Lexington" },
        { value: "Marriott Griffin Gate Resort, 1800 Newtown Pike, Lexington, KY 40511", label: "Marriott Griffin Gate Resort" },
        { value: "Hilton Lexington Downtown, 369 W Vine St, Lexington, KY 40507", label: "Hilton Lexington Downtown" },
        { value: "Hyatt Regency Lexington, 401 W High St, Lexington, KY 40507", label: "Hyatt Regency Lexington" },
    ],
    MDW: [
        { value: "MDW", label: "MDW – Chicago Midway International Airport" },
        { value: "Hilton Chicago, 720 S Michigan Ave, Chicago, IL 60605", label: "Hilton Chicago" },
        { value: "Marriott Chicago Downtown Magnificent Mile, 540 N Michigan Ave, Chicago, IL 60611", label: "Marriott Chicago Downtown" },
        { value: "Hyatt Regency Chicago, 151 E Wacker Dr, Chicago, IL 60601", label: "Hyatt Regency Chicago" },
        { value: "The Westin Michigan Avenue Chicago, 909 N Michigan Ave, Chicago, IL 60611", label: "Westin Michigan Avenue" },
    ],
    IND: [
        { value: "IND", label: "IND – Indianapolis International Airport" },
        { value: "Marriott Indianapolis Downtown, 350 W Maryland St, Indianapolis, IN 46225", label: "Marriott Indianapolis Downtown" },
        { value: "Hilton Indianapolis Hotel & Suites, 120 W Market St, Indianapolis, IN 46204", label: "Hilton Indianapolis" },
        { value: "JW Marriott Indianapolis, 10 S West St, Indianapolis, IN 46204", label: "JW Marriott Indianapolis" },
    ],
    HOU: [
        { value: "HOU", label: "HOU – William P. Hobby Airport, Houston" },
        { value: "Marriott Houston, 1750 Main St, Houston, TX 77002", label: "Marriott Houston" },
        { value: "Hilton Americas-Houston, 1600 Lamar St, Houston, TX 77010", label: "Hilton Americas-Houston" },
        { value: "Hyatt Regency Houston, 1200 Louisiana St, Houston, TX 77002", label: "Hyatt Regency Houston" },
        { value: "Four Seasons Hotel Houston, 1300 Lamar St, Houston, TX 77010", label: "Four Seasons Houston" },
    ],
    IAH: [
        { value: "IAH", label: "IAH – George Bush Intercontinental Airport, Houston" },
        { value: "Marriott Houston Airport, 18700 John F Kennedy Blvd, Houston, TX 77032", label: "Marriott Houston Airport" },
        { value: "Hilton Houston NASA Clear Lake, 3000 NASA Pkwy, Houston, TX 77058", label: "Hilton Houston NASA Clear Lake" },
        { value: "Hyatt Regency Houston Intercontinental Airport, 9300 Airport Blvd, Houston, TX 77061", label: "Hyatt Regency IAH" },
    ],
    PNS: [
        { value: "PNS", label: "PNS – Pensacola International Airport" },
        { value: "Hilton Pensacola Beach, 12 Via De Luna Dr, Pensacola Beach, FL 32561", label: "Hilton Pensacola Beach" },
        { value: "Portofino Island Resort, 10 Portofino Dr, Pensacola Beach, FL 32561", label: "Portofino Island Resort" },
        { value: "Marriott Pensacola Beach Grand Hotel, 1 Via De Luna Dr, Pensacola Beach, FL 32561", label: "Marriott Pensacola Beach" },
    ],
    VPS: [
        { value: "VPS", label: "VPS – Destin–Fort Walton Beach Airport" },
        { value: "Hilton Sandestin Beach Golf Resort & Spa, 4000 S Sandestin Blvd, Miramar Beach, FL 32550", label: "Hilton Sandestin Beach" },
        { value: "Henderson Beach Resort, 200 Henderson Resort Way, Destin, FL 32541", label: "Henderson Beach Resort" },
        { value: "Marriott Vacation Club at Imperial Palms, Fort Walton Beach, FL", label: "Marriott Imperial Palms" },
    ],
    GPT: [
        { value: "GPT", label: "GPT – Gulfport–Biloxi International Airport" },
        { value: "Beau Rivage Resort & Casino, 875 Beach Blvd, Biloxi, MS 39530", label: "Beau Rivage Resort & Casino" },
        { value: "IP Casino Resort Spa, 850 Bayview Ave, Biloxi, MS 39530", label: "IP Casino Resort Spa" },
        { value: "Hard Rock Hotel & Casino Biloxi, 777 Beach Blvd, Biloxi, MS 39530", label: "Hard Rock Biloxi" },
    ],
    ECP: [
        { value: "ECP", label: "ECP – Northwest Florida Beaches International Airport" },
        { value: "Sheraton Bay Point Resort, 4114 Jan Cooley Dr, Panama City Beach, FL 32408", label: "Sheraton Bay Point Resort" },
        { value: "Marriott's BeachPlace Towers, Panama City Beach, FL", label: "Marriott's BeachPlace Towers" },
        { value: "Hilton Panama City Beach, 701 S Thomas Dr, Panama City Beach, FL 32408", label: "Hilton Panama City Beach" },
    ],
    CLT: [
        { value: "CLT", label: "CLT – Charlotte Douglas International Airport" },
        { value: "Marriott Charlotte City Center, 100 W Trade St, Charlotte, NC 28202", label: "Marriott Charlotte City Center" },
        { value: "Hilton Charlotte Uptown, 222 E 3rd St, Charlotte, NC 28202", label: "Hilton Charlotte Uptown" },
        { value: "Hyatt Centric Charlotte, 215 S Chester St, Charlotte, NC 28202", label: "Hyatt Centric Charlotte" },
        { value: "Omni Charlotte Hotel, 132 E Trade St, Charlotte, NC 28202", label: "Omni Charlotte Hotel" },
    ],
    DTW: [
        { value: "DTW", label: "DTW – Detroit Metropolitan Wayne County Airport" },
        { value: "Marriott Detroit Airport, 30559 Flynn Dr, Romulus, MI 48174", label: "Marriott Detroit Airport" },
        { value: "Hilton Detroit Metropolitan Airport, 8600 Merriman Rd, Romulus, MI 48174", label: "Hilton Detroit Airport" },
        { value: "Detroit Marriott at the Renaissance Center, 400 Renaissance Center, Detroit, MI 48243", label: "Marriott Renaissance Center" },
    ],
    TPA: [
        { value: "TPA", label: "TPA – Tampa International Airport" },
        { value: "Tampa Marriott Water Street, 505 Water St, Tampa, FL 33602", label: "Tampa Marriott Water Street" },
        { value: "Hilton Tampa Downtown, 211 N Tampa St, Tampa, FL 33602", label: "Hilton Tampa Downtown" },
        { value: "Hyatt Regency Tampa, 211 N Tampa St, Tampa, FL 33602", label: "Hyatt Regency Tampa" },
        { value: "Grand Hyatt Tampa Bay, 2900 Bayport Dr, Tampa, FL 33607", label: "Grand Hyatt Tampa Bay" },
    ],
    RDU: [
        { value: "RDU", label: "RDU – Raleigh–Durham International Airport" },
        { value: "Marriott Raleigh City Center, 500 Fayetteville St, Raleigh, NC 27601", label: "Marriott Raleigh City Center" },
        { value: "Hilton Raleigh North Hills, 3415 Wake Forest Rd, Raleigh, NC 27609", label: "Hilton Raleigh North Hills" },
        { value: "Sheraton Imperial Hotel Raleigh-Durham Airport, 4700 Emperor Blvd, Durham, NC 27703", label: "Sheraton Raleigh-Durham Airport" },
    ],
    ORF: [
        { value: "ORF", label: "ORF – Norfolk International Airport" },
        { value: "Marriott Norfolk Waterside, 235 E Main St, Norfolk, VA 23510", label: "Marriott Norfolk Waterside" },
        { value: "Hilton Norfolk The Main, 100 E Main St, Norfolk, VA 23510", label: "Hilton Norfolk The Main" },
        { value: "Sheraton Norfolk Waterside Hotel, 777 Waterside Dr, Norfolk, VA 23510", label: "Sheraton Norfolk Waterside" },
    ],
    BDL: [
        { value: "BDL", label: "BDL – Bradley International Airport, Windsor Locks" },
        { value: "Marriott Hartford Downtown, 200 Columbus Blvd, Hartford, CT 06103", label: "Marriott Hartford Downtown" },
        { value: "Hilton Hartford, 315 Trumbull St, Hartford, CT 06103", label: "Hilton Hartford" },
        { value: "Sheraton Hartford South Hotel, 100 Capital Blvd, Rocky Hill, CT 06067", label: "Sheraton Hartford South" },
    ],
    JAX: [
        { value: "JAX", label: "JAX – Jacksonville International Airport" },
        { value: "Marriott Jacksonville Downtown, 245 Water St, Jacksonville, FL 32202", label: "Marriott Jacksonville Downtown" },
        { value: "Hilton Jacksonville Riverfront, 1201 Riverplace Blvd, Jacksonville, FL 32207", label: "Hilton Jacksonville Riverfront" },
        { value: "Hyatt Regency Jacksonville Riverfront, 225 E Coastline Dr, Jacksonville, FL 32202", label: "Hyatt Regency Jacksonville" },
    ],
    JAN: [
        { value: "JAN", label: "JAN – Jackson–Medgar Wiley Evers International Airport" },
        { value: "Hilton Jackson, 1001 E County Line Rd, Jackson, MS 39211", label: "Hilton Jackson" },
        { value: "Marriott Jackson, 200 E Amite St, Jackson, MS 39201", label: "Marriott Jackson" },
        { value: "DoubleTree by Hilton Hotel Jackson, 2850 I-55 N, Jackson, MS 39213", label: "DoubleTree Jackson" },
    ],
};

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
