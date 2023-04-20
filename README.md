# Steam Cardify

> Finds cheap games with profitable cards in Steam!

Steam Cardify is a request based script that retrieves games & cards then calculates profit.
This project is a extended version of [Lucas Genovese's Steam-API](https://github.com/LucasGenovese/Steam-API/), special thanks to him!

## Features
- Finds games cheaper than `maxprice` (default: 10 for Turkey, you must change it for your country)
- Calculates possible profits of game's collection cards and filters them by `cardProfitThreshold` (default: 0.0).
- It comments games as "RISK", "STOCK" and "LOSS". `RISK` means, that the profits standar deviation bigger than `riskSDThreshold`, it means the profits are so far away from eachother, it might be riskfull to invest this game. `LOSS` means there are (-) profits. `STOCK` means, if there are `less than `cardQuantityThreshold` card quantity, it means there are a few of these cards, you might not sell them, so you can lose your money.
- It saves all data that fetches from games and saves it, you can write own script to compare games or you can re-run tool! It will automatically detect existing file and ask you whether it process existing data.
- Exports results to file or console.

## Usage
- Download the repo and open a terminal in working directory, then type this:
```bash
npm install
```
- After installing required modules, you must edit `index.js`
- `apiKey`: _It is `optional`, if you provide it, the script will automatically get your games in library and it will not show you the games you own._
- `cookie`: _It is `required`! You should open [Steam Community](https://steamcommunity.com/) on your browser, then you must log in, after you log in press F12, go to random page, then in the Network tab, find some document data, you will see `Request headers`, copy `Cookie` value and paste here._
- `fetchNgames`: _How many games should be fetched from store page? (You might get blocked temporarily >2500 games)_
- `fetchNgamesStep`: _How many games should be fetcher per request? (MAX: 100)_
- `filterSleepEvery`: _How often should it wait while filtering to prevent blocking._
- `filterSleep`: _How many seconds should it wait between every `filterSleepEvery` filterings?_
- `processFailWait`: _How many seconds should it wait when error occurs while retrieving game info?_
- `fee`: _It is fee, default is 1.00-0.18=`0.82` (Calcualte it by subtracting it from 100 and dividing by 100)_ 
- `cardProfitThreshold`: _Filter cards bigger than this variable._
- `cardProfitThresholdVariable`: _Filter cards' `min, avg (Median of card prices * card drops), avg2 (Possible profits avarage), max` profit bigger than `cardThreshold` variable. (Default: `min`)_
- `cardQuantityThreshold`: _Get cards' quantity bigger than ...._
- `subtractNoCards`: _If card has quantity lower than cardQuantityThreshold, should it count it as (-) LOSS?_
- `riskSDThreshold`: _The limit value for standart deviation of profits._
- `cardPermutationThreshold`: _It is for calculating more precise "avarage" profit & enables "recommending", if card drop count <= `cardPermutationThreshold`it will permutate possible card drops and calculate every single profits_
- `fileName`: _The results file name._
- `saveGameFile`: _Should it save game info file? It can really reduce time if you want to re-run filtering more than one._
- `gameFile`: _The games info file name._
- `logResults`: _Whether should log the results to console?_
- `writeResults`: _Whether should write the results to file?_

- Do not forget to set "Cookie" variable!
- After you set variables, run `npm start`
- Second time you run, it will ask you "Game info file found! Should i process it?"; it means that you can skip fetching game data and use existing data file. It will compare games with your filtering options. (Type "y" if you want to accept it, otherwise you can type anything or "n")

## License
MIT