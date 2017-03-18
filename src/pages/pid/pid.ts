import { Component } from '@angular/core';

import { NavController } from 'ionic-angular';
import { HomePage } from '../home/home';
import { Storage } from '@ionic/storage';
import { Bluetooth } from '../../app/services/ble';
import { BLE } from 'ionic-native';
import { PidDataProcess } from './dataprocess';

@Component({
  selector: 'page-pid',
  templateUrl: 'pid.html'
})
export class PidPage {

  private sensors = [];
  private static sensorsCache = [];
  private static timer = null;
  private static init: boolean = false;
  public static rawSensorData = {};

  constructor(public navCtrl: NavController, private storage: Storage) {
    if(!Bluetooth.adapterInit){
      navCtrl.setRoot(HomePage);
      return;
    }

    if(!PidPage.init){
      BLE.isConnected(Bluetooth.uuid).then(() => {
        this.pushSensor("010C", "GENERAL", "Vehicle RPM", "rpm");
        this.pushSensor("0110", "GENERAL", "Mass Air Flow", "g/sec");
        this.pushSensor("010D", "GENERAL", "Vehicle Speed", "km/h", "mph", kph => {return 0.621371 * kph});

        this.pushSensor("_MPG", "GENERAL", "Fuel Economy", "kml", "mpg", kml => {return 2.35215 * kml}, (pid, obj, sensor) => {
          let mpg;
          let maf = PidPage.rawSensorData["0110"];
          let speed = PidPage.rawSensorData["010D"];

          maf = 37;
          speed = 112;

          if(maf != null && speed != null){
            mpg = ((14.7 * 6.17 * 4.54 * speed * 0.621371) / (3600 * maf / 100)).toFixed(2);
          }
          obj.updateSensor(pid, obj.appendUnits(mpg, sensor));
        });

        PidPage.init = true;
      }).catch(() => {
        HomePage.bleError(navCtrl, storage);
      });
    }else{
      this.sensors = PidPage.sensorsCache;
    }

    PidPage.timer = setInterval(() => {
      BLE.isConnected(Bluetooth.uuid).then(() => {
        for(let i = 0 ; i < this.sensors.length; i++){
          this.update(this.sensors[i].pid);
        }
      }).catch(() => {
        HomePage.bleError(navCtrl, storage);
      });
    }, 1000);

  }

  pushSensor(pid: string, category: string, name: string, unit: string, iUnit?: string, iUnitFunction?: any, updateFunction?: any){
    if(pid.includes("_")){
      this.pushSensorIntoArray(pid, category, name, unit, iUnit, iUnitFunction, updateFunction);
    }else{
      Bluetooth.writeToUUID(pid + "\r").then(data => {
        if(!data.includes("NO_DATA")){
          this.pushSensorIntoArray(pid, category, name, unit, iUnit, iUnitFunction, updateFunction);
        }
      })
    }
  }

  pushSensorIntoArray(pid: string, category: string, name: string, unit: string, iUnit?: string, iUnitFunction?: any, updateFunction?: any){
    let item = {pid: pid, name: name, value: "NO DATA", category: category, unit: unit, updateFunction: null};
    if(iUnit != null){
      item["iUnit"] = iUnit;
      item["iUnitFunction"] = iUnitFunction;
    }
    item["updateFunction"] = updateFunction != null ? updateFunction : this.bluetoothUpdateFunction;
    this.sensors.push(item);
    PidPage.sensorsCache.push(item);
  }

  update(pid: string){
    for(let i = 0; i < this.sensors.length; i++){
      if(this.sensors[i].pid === pid){
        console.log("For PID: " + pid + " the update function is: " + this.sensors[i].updateFunction);
        this.sensors[i].updateFunction(pid, this, this.sensors[i]);
      }
    }
  }

  appendUnits(data, sensor){
    let iUnitConvert = sensor.iUnitFunction;
    let iUnit = sensor.iUnit;
    let unit = sensor.unit;

    if(PidDataProcess.useImperialUnits && iUnitConvert != null){
      return String(data + iUnit);
    }else{
      return String(data + unit);
    }
  }

  updateSensor(pid: string, data){
    for(let i = 0; i < this.sensors.length; i++){
      if(this.sensors[i].pid === pid){
        this.sensors[i].value = data;
      }
    }
  }

  //DO NOT USE this. functions, it will fail!
  bluetoothUpdateFunction(pid, obj, sensor){
    Bluetooth.writeToUUID(pid + "\r").then(data => {
      if(!data.includes("NO_DATA")){
        for(let i = 0; i < obj.sensors.length; i++){
          if(obj.sensors[i].pid === pid){
            let raw_data = PidDataProcess.getData(pid, data);
            PidPage.rawSensorData[pid] = raw_data;
            obj.updateSensor(pid, obj.appendUnits(raw_data, obj.sensors[i]));
          }
        }
      }
    });
  }

  ionViewWillLeave(){
    clearInterval(PidPage.timer);
  }

}
