"""Appendix B fixtures from Falkenhainer, Forbus and Gentner (1989), as Lisp-style text."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "lib"))
from sme import dgroup_from_text

WATER = """(defDescription simple-water-flow
 entities (water beaker vial pipe)
 expressions (((flow beaker vial water pipe) :name wflow)
  ((pressure beaker) :name pressure-beaker)
  ((pressure vial) :name pressure-vial)
  ((greater pressure-beaker pressure-vial) :name >pressure)
  ((greater (diameter beaker) (diameter vial)) :name >diameter)
  ((cause >pressure wflow) :name cause-flow)
  (flat-top water)
  (liquid water)))"""

HEAT = """(defDescription simple-heat-flow
 entities (coffee ice-cube bar heat)
 expressions (((flow coffee ice-cube heat bar) :name hflow)
  ((temperature coffee) :name temp-coffee)
  ((temperature ice-cube) :name temp-ice-cube)
  ((greater temp-coffee temp-ice-cube) :name >temperature)
  (flat-top coffee)
  (liquid coffee)))"""

SOLAR = """(defDescription solar-system
 entities (sun planet)
 expressions (((mass sun) :name mass-sun)
  ((mass planet) :name mass-planet)
  ((greater mass-sun mass-planet) :name >mass)
  ((attracts sun planet) :name attracts)
  ((revolve-around planet sun) :name revolve)
  ((and >mass attracts) :name and1)
  ((cause and1 revolve) :name cause-revolve)
  ((temperature sun) :name temp-sun)
  ((temperature planet) :name temp-planet)
  ((greater temp-sun temp-planet) :name >temp)
  ((gravity mass-sun mass-planet) :name force-gravity)
  ((cause force-gravity attracts) :name why-attracts)))"""

RUTHERFORD = """(defDescription rutherford-atom
 entities (nucleus electron)
 expressions (((mass nucleus) :name mass-n)
  ((mass electron) :name mass-e)
  ((greater mass-n mass-e) :name >mass)
  ((attracts nucleus electron) :name attracts)
  ((revolve-around electron nucleus) :name revolve)
  ((charge electron) :name q-electron)
  ((charge nucleus) :name q-nucleus)
  ((opposite-sign q-nucleus q-electron) :name >charge)
  ((cause >charge attracts) :name why-attracts)))"""

KARLA_BASE = """(defDescription base-5
 entities (Karla hunter feathers cross-bow Failed high)
 expressions (((bird Karla) :name bird-Karla)
  ((person hunter) :name person-hunter)
  ((warlike hunter) :name warlike-hunter)
  ((Karlas-asset feathers) :name feathers-asset)
  ((weapon cross-bow) :name weapon-bow)
  ((used-for feathers cross-bow) :name has-feathers)
  ((not has-feathers) :name not-has-feathers)
  ((attack hunter Karla) :name attack-hunter)
  ((not attack-hunter) :name not-attack)
  ((see Karla hunter) :name see-Karla)
  ((follow see-Karla attack-hunter) :name follow-see-attack)
  ((success attack-hunter) :name success-attack)
  ((equals success-attack Failed) :name failed-attack)
  ((cause not-has-feathers failed-attack) :name cause-failed-attack)
  ((desire hunter feathers) :name desire-feathers)
  ((realize Karla desire-feathers) :name realize-desire)
  ((follow failed-attack realize-desire) :name follow-realize)
  ((offer Karla feathers hunter) :name offer-feathers)
  ((cause realize-desire offer-feathers) :name cause-offer)
  ((obtain hunter feathers) :name take-feathers)
  ((cause offer-feathers take-feathers) :name cause-take)
  ((happiness hunter) :name happiness-hunter)
  ((equals happiness-hunter high) :name happy-hunter)
  ((cause take-feathers happy-hunter) :name cause-happy)
  ((promise hunter Karla not-attack) :name promise-hunter)
  ((cause happy-hunter promise-hunter) :name cause-promise)))"""

TA5 = """(defDescription ta-5
 entities (Zerdia Gagrach supercomputer missiles failed high)
 expressions (((country Zerdia) :name country-Zerdia)
  ((country Gagrach) :name country-Gagrach)
  ((warlike Gagrach) :name warlike-Gagrach)
  ((Zerdias-asset supercomputer) :name supercomputer-asset)
  ((weapon missiles) :name weapon-bow)
  ((used-for supercomputer missiles) :name use-supercomputer)
  ((not use-supercomputer) :name not-use-supercomputer)
  ((attack Gagrach Zerdia) :name attack-Gagrach)
  ((not attack-Gagrach) :name not-attack-Gagrach)
  ((success attack-Gagrach) :name success-attack)
  ((equals success-attack failed) :name failed-attack)
  ((cause not-use-supercomputer failed-attack) :name cause-failed-attack)
  ((desire Gagrach supercomputer) :name desire-supercomputer)
  ((realize Zerdia desire-supercomputer) :name realize-desire)
  ((follow failed-attack realize-desire) :name follow-realize)
  ((offer Zerdia supercomputer Gagrach) :name offer-supercomputer)
  ((cause realize-desire offer-supercomputer) :name cause-offer)
  ((obtain Gagrach supercomputer) :name buy-supercomputer)
  ((cause offer-supercomputer buy-supercomputer) :name cause-buy)
  ((happiness Gagrach) :name happiness-Gagrach)
  ((equals happiness-Gagrach high) :name happy-Gagrach)
  ((cause buy-supercomputer happy-Gagrach) :name cause-happy)
  ((promise Gagrach Zerdia not-attack-Gagrach) :name promise)
  ((cause happy-Gagrach promise) :name cause-promise)))"""

MA5 = """(defDescription ma-5
 entities (Zerdia sportsman feathers cross-bow true)
 expressions (((bird Zerdia) :name bird-Zerdia)
  ((person sportsman) :name person-sportsman)
  ((warlike sportsman) :name warlike-sportsman)
  ((Zerdias-asset feathers) :name feathers-asset)
  ((weapon cross-bow) :name weapon-bow)
  ((used-for feathers cross-bow) :name has-feathers)
  ((desire sportsman feathers) :name desire-feathers)
  ((realize Zerdia desire-feathers) :name realize-desire)
  ((offer Zerdia feathers sportsman) :name offer-feathers)
  ((cause realize-desire offer-feathers) :name cause-offer)
  ((obtain sportsman feathers) :name take-feathers)
  ((cause offer-feathers take-feathers) :name cause-take)
  ((attack sportsman Zerdia) :name attack-sportsman)
  ((not attack-sportsman) :name not-attack)
  ((promise sportsman Zerdia not-attack) :name promise)
  ((cause take-feathers promise) :name cause-promise)
  ((see Zerdia sportsman) :name see-Zerdia)
  ((follow promise see-Zerdia) :name follow-promise)
  ((follow see-Zerdia attack-sportsman) :name follow-see)
  ((success attack-sportsman) :name success-attack)
  ((equals success-attack true) :name successful-attack)
  ((cause has-feathers successful-attack) :name cause-success-attack)
  ((realize Zerdia has-feathers) :name realize-Zerdia)
  ((follow successful-attack realize-Zerdia) :name follow-succ-attack)))"""

FN_PHYS = ["pressure", "diameter", "temperature", "mass", "charge", "gravity"]


def g(text, functions=()):
    return dgroup_from_text(text, functions=functions)

def water(): return g(WATER, FN_PHYS)
def heat(): return g(HEAT, FN_PHYS)
def solar(): return g(SOLAR, FN_PHYS)
def rutherford(): return g(RUTHERFORD, FN_PHYS)
def karla(): return g(KARLA_BASE, ["happiness", "success"])
def ta5(): return g(TA5, ["happiness", "success"])
def ma5(): return g(MA5, ["happiness", "success"])
