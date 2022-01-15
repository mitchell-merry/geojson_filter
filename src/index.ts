import { Feature, FeatureCollection } from "geojson";

import fs from 'fs';
import readline from 'readline';
import JSONStream from 'JSONStream';
import prompt from "prompt-sync";
const promptSync = prompt({ sigint: true });

/**
 * @param filterPath ./data/{filterPath}.txt
 * @returns A promise for the data stored in the filter file.
 */
function getFilterValues(filterPath: string): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {    
        const filterValues: string[] = [];
    
        // Get the absolute filepath of the data
        // let filepath = path.join(__dirname, '..', 'data', `${filterPath}.txt`);
        let filepath = `./data/${filterPath}.txt`;

        // Create a new readline.Interface instance with a readable stream for filepath
        const rl = readline.createInterface({
            input: fs.createReadStream(filepath),
            crlfDelay: Infinity
        });
    
        // On line event, push the value to the filterValues object
        rl.on('line', (line: string) => filterValues.push(line))

        // On close resolve the promise
        rl.on('close', () => resolve(filterValues));
    });
}

function filterDataset(dataFilepath, filterFilepath, filterProperty, changeValueToFilterValue = true): Promise<void> {
    return new Promise(async (resolve, reject) => {
        /* Read and filter */
        let filterVals = await getFilterValues(filterFilepath);
        const valueCount = filterVals.length;

        const stream = fs.createReadStream(`./data/${dataFilepath}`).pipe(JSONStream.parse('features.*'));
        const filteredData: FeatureCollection = { type: "FeatureCollection", features: [] };

        stream.on('data', (data: Feature) => {
            const val = data.properties[filterProperty];
            const matches = filterVals.filter(filterVal => val.includes(filterVal));
            let match = undefined;

            // No matches found
            if(matches.length === 0) return;

            if(matches.length === 1 && matches[0] === val) match = matches[0];
            // If multiple possible matches, or a single non-exact match, ask:
            else {
                console.log(`\nFound possible matches for "${val}":`);
                console.log(matches.map((match, matchIndex) => `${matchIndex+1}) ${match}`).join('\n'));
                const res = parseInt(promptSync(`Choose option [none]: `));
                
                // Invalid option, so assume we use none.
                if(isNaN(res) || res < 1 || res > matches.length) {
                    console.log("Using none...\n");
                    return;
                }

                match = matches[res-1];
            }
            
            // Renames "Greendale (Liverpool - NSW)" to "Greendale" for example, which is what we usually want.
            if(changeValueToFilterValue) data.properties[filterProperty] = match;

            console.log(`[${valueCount-filterVals.length+1}/${valueCount}] Found ${data.properties[filterProperty]}...`);
            filteredData.features.push(data);

            filterVals = filterVals.filter(i => i !== match);
        });

        stream.on('close', () => {
            if(filterVals.length !== 0) {
                /* Output filtered values */
                console.log(`Found ${filteredData.features.length}:`);
                console.log(filteredData.features.map(feature => feature.properties[filterProperty]));

                console.log(`Missing: ${filterVals.length}:`);
                console.log(filterVals);
            } else {
                console.log("Found all filter values!");
            }
            
            /* Save */
            fs.writeFileSync(`./data/${filterFilepath}.geojson`, JSON.stringify(filteredData));
            resolve();
        });
    })
}

filterDataset("AUS_SUB.geojson", "LVP_SUB", "SSC_NAME_2016");