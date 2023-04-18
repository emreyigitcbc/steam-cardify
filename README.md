# Steam Cardify

> Finds cheap games with profitable cards in Steam!

Steam Cardify is a request based script that retrieves games & cards then calculates profit.
This project is a extended/modified version of [Lucas Genovese's Steam-API](https://github.com/LucasGenovese/Steam-API/), special thanks to him!

## Features
- Finds games cheaper than `maxprice` (default: 10 for Turkey, you must change it for your country)
- Calculates possible profits of game's collection cards and filters them by `cardProfitThreshold` (default: 0.0).
- It comments games as "RISK", "RCMD" and "LOSS". `RISK` means, that game is risky because the difference between cards are bigger than `recommendMAMThreshold` (def: 1.01). `RCMD` means, RECOMMENDED; if `recommendDiffThresholdCount` (default: 3) cards' profit is bigger than `recommendDiffThreshold` (default: 0.4), it recommends the game. So, the profits are good. `LOSS` means there are (-) profits.
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
- `filterSleepEvery`: _How often should it wait while filtering to prevent blocking._
- `filterSleep`: _How many seconds should it wait between every `filterSleepEvery` filterings?_
- `fee`: _It is fee, default is 1.00-0.18=`0.82`_
- `cardProfitThreshold`: _Filter cards bigger than this variable._
- `cardProfitThresholdVariable`: _Filter cards' `min, avg, max` profit bigger than `cardThreshold` variable. (Default: `min`)_
- `cardQuantityThreshold`: _Get cards' quantity bigger than ...._
- `recommendDiffThreshold`: _Recommend cards' that difference between some profits are bigger than ..._
- `recommendDiffThresholdCount`: _Recommend cards' that difference between some profits are bigger than `recommendDiffThreshold` for ... times_
- `recommendMAMThreshold`: _Comment cards' that difference between "min, avg, max" profits are lower than... (comments game as RISKY)_
- `recommendOnlyProfitable`: _Whether it include only profitable games or not?_
- `cardPermutationThreshold`: _It is for calculating more precise "avarage" profit & enables "recommending", if card drop count <= `cardPermutationThreshold`it will permutate possible card drops and calculate every single profits_
- `fileName`: _The results file name._
- `logResults`: _Whether should log the results to console?_
- `writeResults`: _Whether should write the results to file?_

- After you set variables, run `npm start`

## License
MIT