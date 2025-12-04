// Copyright 2025 Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import { Request, Response } from "express";
const NetworksInfo = require("../../utils/networks-info.js");

function formatError(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

/**
 * Builds a CSV string from an array of headers and rows.
 * @param {string[]} headers - Ordered column names.
 * @param {Array<Array<any>>} rows - Array of rows, each row being an array of field values corresponding to headers.
 * @returns {string} The CSV content where each field is wrapped in double quotes and internal double quotes are escaped. 
 */
function generateCsv(headers: string[], rows: string[][]): string {
    const csvBuilder = [];
    
    // Function to wrap each field with quotes and escape quotes inside the field
    const wrapWithQuotes = (field: any) => {
        return `"${String(field).replace(/"/g, '""')}"`;
    };

    // Add headers to CSV, wrapping each header with quotes
    csvBuilder.push(headers.map(wrapWithQuotes).join(','));
    
    // Add each row to CSV, wrapping each field with quotes
    rows.forEach(row => {
        csvBuilder.push(row.map(wrapWithQuotes).join(','));
    });

    return csvBuilder.join('\n');
}

/**
 * Collects all unique property names from an array of record objects.
 * @param {Object[]} records - Array of objects to extract keys from.
 * @returns {string[]} Array of unique header names found across all records.
 */
function gatherHeaders(records: Record<string, unknown>[]): string[] {
    const headersSet = new Set<string>();
    records.forEach(record => {
        Object.keys(record).forEach(key => {
            headersSet.add(key); // Add all unique headers
        });
    });
    return Array.from(headersSet); // Convert the Set back to an array
}

/**
 * Responds with a CSV containing all districts.
 *
 * Retrieves all districts, constructs a CSV with dynamically gathered headers and rows, and sends it with Content-Type `text/csv`. On failure sends HTTP 500 with the error message.
 */
async function getDistrictsCsv(_req: Request, res: Response) {
    try {
        const districts = await NetworksInfo.getAllDistricts();

        // Gather all unique headers dynamically from all the objects' attribute names
        const headers = gatherHeaders(districts as Record<string, unknown>[]);

        // Prepare rows for CSV based on the headers
        const rows = districts.map((district: Record<string, any>) =>
            headers.map(header => String(district[header] ?? ''))
        );

        // Generate CSV content
        const csvContent = generateCsv(headers, rows);

        // Return CSV
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="districts.csv"');
        res.send(csvContent);
    } catch (err) {
        console.error('Error generating districts CSV:', err);
        res.status(500).send('Internal server error generating CSV');
    }
}

/**
 * Send all districts' local information as a CSV response.
 *
 * Retrieves all district-local-info records, infers CSV headers from the union of object keys,
 * generates CSV rows aligned to those headers, sets Content-Type to `text/csv`, and sends the CSV.
 * On error responds with HTTP 500 and an error message.
 */
async function getDistrictsLocalInfoCsv(_req: Request, res: Response) {
    try {
        const districtsLocalInfos = await NetworksInfo.getAllDistrictLocalInfos();

        // Gather all unique headers dynamically from all the objects' attribute names
        const headers = gatherHeaders(districtsLocalInfos as Record<string, unknown>[]);

        // Prepare rows for CSV based on the headers
        const rows = districtsLocalInfos.map((info: Record<string, any>) =>
            headers.map(header => String(info[header] ?? ''))
        );

        // Generate CSV content
        const csvContent = generateCsv(headers, rows);

        // Return CSV
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="districts-local-info.csv"');
        res.send(csvContent);
    } catch (err) {
        res.status(500).send('Error generating CSV: ' + formatError(err));
    }
}

/**
 * Send all networks as a CSV response.
 *
 * Fetches all networks, builds a CSV with headers gathered from the network objects (ensuring
 * `contactEmail` and `aboutText` are present), injects specific `contactEmail`/`aboutText` values
 * for known networks by `uniqueId`, and returns the CSV with Content-Type `text/csv`.
 *
 * On failure, responds with HTTP 500 and an error message.
 */
async function getNetworksCsv(_req: Request, res: Response) {
    try {
        const networks = await NetworksInfo.getAllNetworks();

        // Gather all unique headers dynamically from all the objects' attribute names
        const headers = gatherHeaders(networks);

        // Ensure that 'contactEmail' and 'aboutText' headers are present
        if (!headers.includes('contactEmail')) {
            headers.push('contactEmail');
        }
        if (!headers.includes('aboutText')) {
            headers.push('aboutText');
        }

        // Prepare rows for CSV based on the headers
        const rows = networks.map((network: Record<string, any>) => {
            // Initialize the row with values based on headers
            const row = headers.map(header => String(network[header] ?? ''));

            row[headers.indexOf('contactEmail')] = '';
            row[headers.indexOf('aboutText')] = '';

            // Additional custom logic for specific networks based on uniqueId
            switch (network.uniqueId) {
                case 'croftlitter':
                    row[headers.indexOf('contactEmail')] = 'croft@litternetworks.org';
                    row[headers.indexOf('aboutText')] = `<p>Welcome to 'Croft Litter Network' - your community-run resource for reporting and volunteering to clean up litter problems in our amazing area!</p><p>Spotted a litter problem? Simply post on the 'Croft Litter Network' Facebook group with as much info as you can - ideally including a description of the problem and where to find it, perhaps photos, and a map / what3words location.</p><p>Cleaned up some litter? Simply comment on the post it was reported on, or if your own ad-hoc route (perhaps your daily exercise route?), then please do let us know via a new post (again on the 'Croft Litter Network' group) the route / area you've cleaned so others know it may not need doing again for a while (or that it may need checking again soon!)</p><p>If you are interested in taking part we recommend a litter-picking kit (at least a picker / grabber, bin bags and strong gloves - safety first every time). Home Bargains, B&M and (online) Pickerz sell grabbers at a very reasonable price, or if you'd like pro-quality kit then (online) HH Environmental are industry-standard. And perhaps we can between us bulk-purchase kit at a discount community price if there is enough interest.   Some groups in the network may even be able to loan us kit!</p>`;
                    break;
                case 'fairfieldandhowleylitter':
                    row[headers.indexOf('contactEmail')] = 'fh@litternetworks.org';
                    break;
                case 'winwicklitter':
                    row[headers.indexOf('contactEmail')] = 'winwick@litternetworks.org';
                    break;
                case 'tptwarrington':
                    row[headers.indexOf('aboutText')] = `<p>Welcome to 'Trans Pennine Trail Warrington Litter Network' - your community-run resource for reporting and volunteering to clean up litter problems at any point on this fantastic cross-country trail which runs east/west through our town!</p><p>Spotted a litter problem? Simply post on the 'Trans Pennine Trail Warrington Litter Network' Facebook group with as much info as you can - ideally including a description of the problem and where to find it, perhaps photos, and a map / what3words location.</p><p>Cleaned up some litter? Simply comment on the post it was reported on, or if your own ad-hoc route (perhaps your daily exercise route?), then please do let us know via a new post (again on our Facebook group) the route / area you've cleaned so others know it may not need doing again for a while (or that it may need checking again soon!)</p><p>If you are interested in taking part we recommend a litter-picking kit (at least a picker / grabber, bin bags and strong gloves - safety first every time). Home Bargains, B&M and (online) Pickerz sell grabbers at a very reasonable price, or if you'd like pro-quality kit then (online) HH Environmental are industry-standard. It is worth asking whether any free kit is available also - which is periodically the case!</p>`;
                    break;
                case 'warringtoncentrelitter':
                    row[headers.indexOf('aboutText')] = `<p>Welcome to 'Warrington Centre Litter Network' - your community-run resource for reporting and volunteering to clean up litter problems in our town centre!</p><p>Spotted a litter problem? Simply post on the 'Warrington Centre Litter Network' Facebook group with as much info as you can - ideally including a description of the problem and where to find it, perhaps photos, and a map / what3words location.</p><p>Cleaned up some litter? Simply comment on the post it was reported on, or if your own ad-hoc route (perhaps your daily exercise route?), then please do let us know via a new post (again on our Facebook group) the route / area you've cleaned so others know it may not need doing again for a while (or that it may need checking again soon!)</p><p>If you are interested in taking part we recommend a litter-picking kit (at least a picker / grabber, bin bags and strong gloves - safety first every time). Home Bargains, B&M and (online) Pickerz sell grabbers at a very reasonable price, or if you'd like pro-quality kit then (online) HH Environmental are industry-standard. It is worth asking whether any free kit is available also - which is periodically the case!</p>`;
                    break;
                case 'riverweaverlitter':
                    row[headers.indexOf('aboutText')] = `<p>Welcome to 'River Weaver Litter Network' - your community-run resource for reporting and volunteering to clean up litter problems at any point on this lovely waterway which runs for over 50 miles through some of the most beautiful and historic parts of Cheshire!</p><p>Spotted a litter problem? Simply post on the 'River Weaver Litter Network' Facebook group with as much info as you can - ideally including a description of the problem and where to find it, perhaps photos, and a map / what3words location.</p><p>Cleaned up some litter? Simply comment on the post it was reported on, or if your own ad-hoc route (perhaps your daily exercise route?), then please do let us know via a new post (again on our Facebook group) the route / area you've cleaned so others know it may not need doing again for a while (or that it may need checking again soon!)</p><p>If you are interested in taking part we recommend a litter-picking kit (at least a picker / grabber, bin bags and strong gloves - safety first every time). Home Bargains, B&M and (online) Pickerz sell grabbers at a very reasonable price, or if you'd like pro-quality kit then (online) HH Environmental are industry-standard. It is worth asking whether any free kit is available also - which is periodically the case!</p>`;
                    break;
                case 'manchesterlitter':
                    row[headers.indexOf('aboutText')] = `<p>Welcome to 'Manchester Central Litter Network' - your community-run resource for reporting and volunteering to clean up litter problems in our vibrant and historic city centre!</p><p>Spotted a litter problem? Simply post on the 'Manchester Central Litter Network' Facebook group with as much info as you can - ideally including a description of the problem and where to find it, perhaps photos, and a map / what3words location.</p><p>Cleaned up some litter? Simply comment on the post it was reported on, or if your own ad-hoc route (perhaps your daily exercise route?), then please do let us know via a new post (again on our Facebook group) the route / area you've cleaned so others know it may not need doing again for a while (or that it may need checking again soon!)</p><p>If you are interested in taking part we recommend a litter-picking kit (at least a picker / grabber, bin bags and strong gloves - safety first every time). Home Bargains, B&M and (online) Pickerz sell grabbers at a very reasonable price, or if you'd like pro-quality kit then (online) HH Environmental are industry-standard. It is worth asking whether any free kit is available also - which is periodically the case!</p>`;
                    break;
                // Add more cases as needed
            }

            return row;
        });


        // Generate CSV content
        const csvContent = generateCsv(headers, rows);

        // Return CSV
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="networks.csv"');
        res.send(csvContent);
    } catch (err) {
        res.status(500).send('Error generating CSV: ' + formatError(err));
    }
}

// Export the functions to register them in the router
module.exports = {  getDistrictsCsv, getDistrictsLocalInfoCsv, getNetworksCsv  };
