#!/bin/sh
rm -rf anime-ratings
mkdir anime-ratings
zip anime-ratings.zip icon128.png icon16.png icon48.png content.js eventPage.js manifest.json

# DEVELOP
rm -rf anime-ratings
# This should only be enabled when doing 
# development testing using local chrome
rm -rf unzipped
mkdir unzipped
cp anime-ratings.zip ./unzipped/
open unzipped/anime-ratings.zip 
