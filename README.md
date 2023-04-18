# Steam Cardify

> Finds cheap games with profitable cards in Steam!

Steam Cardify is a request based script that retrieves games & cards then calculates profit.
This project is a extended/modified version of [Lucas Genovese's Steam-API](https://github.com/LucasGenovese/Steam-API/), special thanks to him!

## Features
- Finds games cheaper than `maxprice` (default: 10 for Turkey, you must change it for your country)
- Calculates possible profits of game's collection cards and filters them by `cardThreshold` (default: 0.0).
- Exports results to file or console.

## Usage
- Download the repo and open a terminal in working directory, then type this:
```bash
npm install
```
- After installing required modules, you must edit `index.js`
- `apiKey`: _It is `optional`, if you provide it, the script will automatically get your games in library and it will not show you the games you own._
- `cookie`: _It is `required`! You should open [Steam Community](https://steamcommunity.com/) on your browser, then you must log in, after you log in press F12, go to random page, then in the Network tab, find some document data, you will see `Request headers`, copy `Cookie` value and paste here._
- `fetchNgames`: _How many games should be fetched from store page?_
- `fetchNgamesStep`: _How many games should be fetcher per request?_
- `fee`: _It is fee, default is 1.00-0.18=`0.82`_
- `cardThreshold`: _Filter cards bigger than this variable._
- `cardThresholdVariable`: _Filter cards' `min, avg, max` profit bigger than `cardThreshold` variable. (Default: `min`)_
- `fileName`: _The results file name._
- `logResults`: _Whether should log the results to console?_
- `writeResults`: _Whether should write the results to file?_

- After you set variables, run `npm start`

## License
MIT