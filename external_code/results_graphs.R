library(sf)
library(dplyr)
library(tidyr)
library(ggplot2)
library(RColorBrewer)
library(scales)

ne_results = read_sf('/results/ne_results_comparison_full.shp')
bos_results = read_sf('/results/boston_results.shp')

# build tes difference graphs
breaks <- c(-75, -30, -10, 10, 30, 75)
breaks_fine <- seq(-75, 75, by = 5)
axis_breaks <- c(-70, -50, -30, -10, 10, 30, 50, 70)
axis_labels <- c('-70', '-50', '-30', '-10', '10', '30', '50', '70')
ne_results %>%
  ggplot(aes(x = tes_diff, fill = tes_diff)) + 
  stat_bin(breaks = breaks_fine, aes(y = ..count.. / 6475, fill = ..x..), center = 0, colour = 'grey') +
  scale_fill_fermenter(breaks = breaks, type = "div", palette = "PuOr", direction = -1, aesthetics = "fill") + #, values = rescale(breaks, to = c(0,1)), guide = "coloursteps") +
  scale_x_continuous(name = "Difference in Equity Scores (Ours - Original)", breaks = axis_breaks, labels = axis_labels) + 
  labs(x = "Difference in Equity Scores (Ours - Original)", y = "Percent of Block Groups", title = "Comparison of Results: New England")+
  theme_bw() +
  theme(legend.position = "none", plot.title = element_text(hjust = 0.5))

bos_results %>%
  ggplot(aes(x = tes_diff, fill = tes_diff)) + 
  stat_bin(breaks = breaks_fine, aes(y = ..count.. / 1821, fill = ..x..), center = 0, colour = 'grey') +
  scale_fill_fermenter(breaks = breaks, type = "div", palette = "PuOr", direction = -1, aesthetics = "fill") + #, values = rescale(breaks, to = c(0,1)), guide = "coloursteps") +
  scale_x_continuous(name = "Difference in Equity Scores (Ours - Original)", breaks = axis_breaks, labels = axis_labels) + 
  labs(x = "Difference in Equity Scores (Ours - Original)", y = "Percent of Block Groups", title = "Comparison of Results: Boston, MA")+
  theme_bw() +
  theme(legend.position = "none", plot.title = element_text(hjust = 0.5))

# build priority graph
breaks <- c(-0.75, -0.30, -0.10, 0.10, 0.30, 0.75)
breaks_fine <- seq(-0.75, 0.75, by = 0.05)
axis_breaks <- c(-0.70, -0.50, -0.30, -0.10, 0.10, 0.30, 0.50, 0.70)
axis_labels <- c('-0.70', '-0.50', '-0.30', '-0.10', '0.10', '0.30', '0.50', '0.70')
ne_results %>%
  ggplot(aes(x = prty_diff, fill = prty_diff)) + 
  stat_bin(breaks = breaks, aes(y = ..count.. / 6475, fill = ..x..), center = 0, colour = 'grey') +
  scale_fill_fermenter(breaks = breaks, type = "div", palette = "PuOr", direction = -1, aesthetics = "fill") + #, values = rescale(breaks, to = c(0,1)), guide = "coloursteps") +
  scale_x_continuous(name = "Difference in Priority Scores (Ours - Original)", breaks = axis_breaks, labels = axis_labels) + 
  labs(x = "Difference in Equity Scores (Ours - Original)", y = "Percent of Block Groups", title = "Comparison of Results: New England")+
  theme_bw() +
  theme(legend.position = "none", plot.title = element_text(hjust = 0.5))
