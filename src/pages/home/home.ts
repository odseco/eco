import { Component } from '@angular/core';

import { NavController, MenuController, AlertController, Events, ModalController, NavParams } from 'ionic-angular';
import { BLE } from 'ionic-native';
import { Storage } from '@ionic/storage';

import { Bluetooth } from '../../app/services/ble';
import { EntryPage } from '../entry/entry';
import { VehicleSelectPage } from '../vehicle-select/vehicle-select';
import { TripPage } from '../trip/trip';
import { LeaderboardLoginPage } from "../leaderboard-login/leaderboard-login";
import { DriveBetterPage } from '../drive-better/drive-better';

@Component({
  selector: 'page-home',
  templateUrl: 'home.html'
})
export class HomePage {

  private device : any = {name: "Unknown Adapter", id: "Unknown ID"};
  private vehicle: any = {name: "Not Selected", epaInfo: {primaryFuel: null}}
  private leaderboard: any;

  constructor(public navCtrl: NavController, public alertCtrl: AlertController, public menuCtrl: MenuController, private storage: Storage, public modalCtrl: ModalController, public events: Events, public navParams: NavParams) {  
    if(Bluetooth.uuid != null){
      BLE.isConnected(Bluetooth.uuid).then(() => {
        this.device = Bluetooth.device;
        if(!Bluetooth.adapterInit){
          Bluetooth.startNotification();
          Bluetooth.writeToUUID("ATZ\r").catch(() => {
            HomePage.bleError(navCtrl, storage);
          });
          Bluetooth.writeToUUID("ATSP0\r").then(result => {
            Bluetooth.adapterInit = true;
            console.log("Initialization is complete");
          }).catch(() => {
            HomePage.bleError(navCtrl, storage);
          });
        }
      }).catch(() => {
        HomePage.bleError(navCtrl, storage);
      });
    }else{
      if(!Bluetooth.debugMode){
        HomePage.bleError(navCtrl, storage);
      }
    }

    events.subscribe('vehicle:selected', (user, time) => {
      this.updateVehicle();
    });

    events.subscribe('leaderboard:selected', () => {
      this.updateLeaderboardInfo();
    });

    this.updateVehicle();
    this.updateLeaderboardInfo();
  }

  updateLeaderboardInfo(){
    this.storage.get("leaderboard").then(data => {
      if(data != null){
        this.leaderboard = JSON.parse(data);;
      }
    });
  }

  selectVehicle(){
    let modal = this.modalCtrl.create(VehicleSelectPage);
    modal.present();
  }

  joinLeaderboard(){
    let modal = this.modalCtrl.create(LeaderboardLoginPage);
    modal.present();
  }

  startTrip(){
    this.storage.get("vehicle").then(data => {
      if(data != null){
        let ecoData = JSON.parse(data);
        console.log(JSON.stringify(ecoData))
        this.navCtrl.setRoot(TripPage);
      }else{
        let alert = this.alertCtrl.create({
          title: 'Error!',
          subTitle: 'You need to select a vehicle before starting a trip',
          buttons: ['OK']
        });
        alert.present();
      }
    });
  }

  ionViewDidEnter(){
    this.menuCtrl.swipeEnable(true);
    this.updateVehicle();
  }

  updateVehicle(){
    this.storage.ready().then(() => {
      this.storage.get("vehicleName").then(name => {
        if(name != null){
          this.storage.get("vehicle").then(info => {
            this.vehicle.name = name;
            this.vehicle.epaInfo = JSON.parse(info);
          })
        }else{
          this.vehicle.name = "Not Selected";
        }
      });
    });
  }

  public static bleError(navCtrl, storage, err?: any){
    storage.ready().then(() => {
     storage.set('uuid', null);
     storage.set('name', null);

     console.log("Attempted to disconnect at bleError()");
     BLE.disconnect(Bluetooth.uuid).then(() => {
       navCtrl.setRoot(EntryPage);
     }).catch(() => {
       navCtrl.setRoot(EntryPage);
     });
    });

    if(Bluetooth.debugMode){
      if(err != null){
        throw err;
      }
    }
  }

  driveBetter(){
    let modal = this.modalCtrl.create(DriveBetterPage);
    modal.present();
  }
}
