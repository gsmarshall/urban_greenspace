# This script queries the US Census API for the American Community Survey data needed to create the priority index 
# used by Tree Equity Score.
# Output: a shapefile that has one column for each variable requested, plus several columns with
# identifying info and general info about each block group


library(tidycensus)
library(sf)
library(dplyr)
library(tidyr)

mykey = 'census API key'

# all variables needed to reproduce Tree Equity Score priority index (https://treeequityscore.org/datasources/)
# variable names sourced from US Census ACS table list, available here (https://www.census.gov/programs-surveys/acs/technical-documentation/table-shells.2018.html)
myvars = c('B01001_001', 'B03002_003', 'B03002_001', 'B23025_006', 'B23025_001', 'B01001_003', 'B01001_004', 'B01001_005',
           'B01001_006', 'B01001_027', 'B01001_028', 'B01001_029', 'B01001_030', 'B01001_044', 'B01001_045', 'B01001_046',
           'B01001_047', 'B01001_048', 'B01001_049', 'B01001_020', 'B01001_021', 'B01001_022', 'B01001_023', 'B01001_024',
           'B01001_025')


#FIPS code NH = 33, Hillsborough county = 011
blockgrps = get_acs(geography = "block group", variables = myvars, year = 2018, state = 33, county = 011, geometry = TRUE,
                    keep_geo_vars = TRUE, key = mykey, show_call = TRUE)

# get values for just one dummy variable in order to extract geometries
blockgrps_geom = get_acs(geography = "block group", variables = 'B01001_001', year = 2018, state = 33, county = 011, geometry = TRUE,
                    keep_geo_vars = TRUE, key = mykey, show_call = TRUE) %>% select(GEOID) 
# selecting GEOID makes it easier to join geometries back to other data
# because this is a spatial data frame (an sf object), this select operation also takes the geometry column
  


id_cols = c("STATEFP", "COUNTYFP", "GEOID", "ALAND", "AWATER", "NAME.y")

blockgrps_wide <- blockgrps %>% 
  st_set_geometry(NULL) %>% # drop geometry to manipulate data into wide form
  pivot_wider(id_cols = c("STATEFP", "COUNTYFP", "GEOID", "ALAND", "AWATER", "NAME.y"), names_from = "variable", values_from = "estimate") %>% 
  left_join(blockgrps_geom, by = "GEOID") %>% # join geometry back to data
  st_sf() %>% # save as sf object
  write_sf("/local file path") # write to file