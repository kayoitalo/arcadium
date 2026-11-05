"use client";
import { useEffect, useRef, useState } from "react";
import { privateFetch } from "@/lib/http/private-fetch";
import { artistPhotoResultSchema, type ArtistPhotoResult } from "@/modules/enrichment/domain/artist-portrait";
/** Only the selected name is requested; quick changes cancel before the request. */
export function useArtistPhoto(name?:string) {
  const cache=useRef(new Map<string,ArtistPhotoResult>());const [attempt,setAttempt]=useState(0);
  const [state,setState]=useState<{name?:string;value:ArtistPhotoResult|null;error:boolean;loading:boolean}>({value:null,error:false,loading:false});
  useEffect(()=>{
    if(!name)return;
    const saved=cache.current.get(name);if(saved){setState({name,value:saved,error:false,loading:false});return;}
    const controller=new AbortController();setState({name,value:null,error:false,loading:true});
    const timer=setTimeout(()=>{void privateFetch("/api/artist-portrait",{method:"POST",headers:{"Content-Type":"application/json"},signal:controller.signal,body:JSON.stringify({artistName:name})})
      .then(async response=>{if(!response.ok)throw new Error();const value=artistPhotoResultSchema.parse(await response.json());if(controller.signal.aborted)return;
        cache.current.set(name,value);while(cache.current.size>32)cache.current.delete(cache.current.keys().next().value!);setState({name,value,error:false,loading:false});})
      .catch(()=>{if(!controller.signal.aborted)setState({name,value:null,error:true,loading:false});});},300);
    return()=>{clearTimeout(timer);controller.abort();};
  },[name,attempt]);
  const saved = name ? cache.current.get(name) : undefined;
  return {...(state.name===name?state:saved?{value:saved,error:false,loading:false}:{value:null,error:false,loading:Boolean(name)}),retry:()=>{if(name)cache.current.delete(name);setAttempt(n=>n+1);}};
}
