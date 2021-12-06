# This script queries the US Census API for the American Community Survey data needed to create the priority index 
# used by Tree Equity Score.
# Output: a shapefile that has one column for each variable requested, plus several columns with
# identifying info and general info about each block group


library(tidycensus)
library(sf)
library(dplyr)
library(tidyr)
library(tigris)

mykey = 'census api key'

# all variables needed to reproduce Tree Equity Score priority index (https://treeequityscore.org/datasources/)
# variable names sourced from US Census ACS table list, available here (https://www.census.gov/programs-surveys/acs/technical-documentation/table-shells.2018.html)
myvars = c('B01001_001', 'B03002_003', 'B03002_001', 'B23025_006', 'B23025_001', 'B01001_003', 'B01001_004', 'B01001_005',
           'B01001_006', 'B01001_027', 'B01001_028', 'B01001_029', 'B01001_030', 'B01001_044', 'B01001_045', 'B01001_046',
           'B01001_047', 'B01001_048', 'B01001_049', 'B01001_020', 'B01001_021', 'B01001_022', 'B01001_023', 'B01001_024',
           'B01001_025', 'C17002_001', 'C17002_008')

# states to select data for - NH, VT, NY, ME, MA, RI, CT
states = c(33, 50, 36, 23, 25, 44, 09)


#FIPS code NH = 33, Hillsborough county = 011
blockgrps = get_acs(geography = "block group", variables = myvars, year = 2018, state = states, geometry = TRUE,
                    keep_geo_vars = TRUE, key = mykey, show_call = TRUE)

# get values for just one dummy variable in order to extract geometries
blockgrps_geom = get_acs(geography = "block group", variables = 'B01001_001', year = 2018, state = states, geometry = TRUE,
                    keep_geo_vars = TRUE, key = mykey, show_call = TRUE) %>% select(GEOID) 
# selecting GEOID makes it easier to join geometries back to other data
# because this is a spatial data frame (an sf object), this select operation also takes the geometry column
  
# get census places to delineate analysis regions
metro_geoms = get_acs(geography = "place", variables = 'B01001_001', year = 2018, state = states, geometry = TRUE,
                      keep_geo_vars = TRUE, key = mykey, show_call = TRUE) %>% select(place_GEOID, place_name = NAME.y)

metro_group = metro_geoms %>% group_by(place_name)


# metro_geoms %>% write_sf("C:/Users/gsmar/Documents/Middlebury/Fall 21/CS 701/urban_greenspace/data/metro_areas.shp")

id_cols = c("STATEFP", "COUNTYFP", "GEOID", "ALAND", "AWATER", "NAME.y")

blockgrps_wide <- blockgrps %>% 
  st_set_geometry(NULL) %>% # drop geometry to manipulate data into wide form
  pivot_wider(id_cols = c("STATEFP", "COUNTYFP", "GEOID", "ALAND", "AWATER", "NAME.y"), names_from = "variable", values_from = "estimate") %>% 
  left_join(blockgrps_geom, by = "GEOID") %>% # join geometry back to data
  st_sf() # save as sf object


# get metro areas and join
metros <- core_based_statistical_areas(cb = TRUE) %>%
  st_filter(blockgrps_geom, .predicate = st_contains) %>% # select metro areas in new england + new york
  select(metro_name = NAME)

# write to file in order to check if it worked correctly - visually check the map
write_sf(metro_geoms, "local file path")


blockgrps_metros <- st_join(blockgrps_wide, metro_geoms, join = st_within, 
                   left = FALSE) 

write_sf(blockgrps_metros, "local file path") # write to file
