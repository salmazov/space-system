#pragma once

#include "CoreMinimal.h"
#include "Widgets/SCompoundWidget.h"

struct FSpaceSystemShipView;
struct FSpaceSystemPlanetView;
struct FSpaceSystemStoreView;
struct FSpaceSystemExploredAreaView;
struct FSpaceSystemSosSignalView;
struct FSpaceSystemShipClassView;
struct FSpaceSystemMissionView;
class SSpaceSystemMiniMapCanvas;

DECLARE_DELEGATE_ThreeParams(FOnTradeAction, const FString& /* GoodId */, bool /* bIsBuy */, int32 /* Qty */);
DECLARE_DELEGATE_OneParam(FOnTravelAction, const FString& /* PlanetId */);
DECLARE_DELEGATE(FOnSosAction);
DECLARE_DELEGATE_TwoParams(FOnShareFuelAction, const FString& /* TargetClientId */, int32 /* Qty */);
DECLARE_DELEGATE_OneParam(FOnBuyShipAction, const FString& /* ShipClassId */);
DECLARE_DELEGATE_OneParam(FOnAcceptMissionAction, const FString& /* MissionId */);

class SSpaceSystemHUD : public SCompoundWidget
{
public:
	SLATE_BEGIN_ARGS(SSpaceSystemHUD) {}
		SLATE_EVENT(FOnTradeAction, OnTrade)
		SLATE_EVENT(FOnTravelAction, OnTravel)
		SLATE_EVENT(FOnSosAction, OnSos)
		SLATE_EVENT(FOnShareFuelAction, OnShareFuel)
		SLATE_EVENT(FOnBuyShipAction, OnBuyShip)
		SLATE_EVENT(FOnAcceptMissionAction, OnAcceptMission)
	SLATE_END_ARGS()

	void Construct(const FArguments& InArgs);

	void UpdateState(
		const FSpaceSystemShipView* OwnShip,
		const TArray<FSpaceSystemPlanetView>& Planets,
		const TArray<FSpaceSystemShipView>& Ships,
		const TArray<FSpaceSystemStoreView>& Stores,
		const TArray<FSpaceSystemExploredAreaView>& ExploredAreas,
		const TArray<FSpaceSystemSosSignalView>& SosSignals,
		const TArray<FSpaceSystemShipClassView>& ShipClasses,
		const TArray<FSpaceSystemMissionView>& Missions,
		const FString& ConnectionStatus,
		const FString& HintText,
		const FString& ClientId,
		int32 Tick
	);

private:
	TSharedRef<SWidget> BuildResourceBar();
	TSharedRef<SWidget> BuildMarketPanel();
	TSharedRef<SWidget> BuildSosPanel();
	TSharedRef<SWidget> BuildMiniMap();

	void RebuildMarketContent();
	void RebuildSosContent();

	FOnTradeAction OnTrade;
	FOnTravelAction OnTravel;
	FOnSosAction OnSos;
	FOnShareFuelAction OnShareFuel;
	FOnBuyShipAction OnBuyShip;
	FOnAcceptMissionAction OnAcceptMission;

	// Cached state
	const FSpaceSystemShipView* CachedOwnShip = nullptr;
	const TArray<FSpaceSystemPlanetView>* CachedPlanets = nullptr;
	const TArray<FSpaceSystemShipView>* CachedShips = nullptr;
	const TArray<FSpaceSystemStoreView>* CachedStores = nullptr;
	const TArray<FSpaceSystemExploredAreaView>* CachedExploredAreas = nullptr;
	const TArray<FSpaceSystemSosSignalView>* CachedSosSignals = nullptr;
	const TArray<FSpaceSystemShipClassView>* CachedShipClasses = nullptr;
	const TArray<FSpaceSystemMissionView>* CachedMissions = nullptr;
	FString CachedConnectionStatus;
	FString CachedHintText;
	FString CachedClientId;
	int32 CachedTick = 0;

	// Widget refs for dynamic updates
	TSharedPtr<STextBlock> ResourceText;
	TSharedPtr<SVerticalBox> MarketBox;
	TSharedPtr<STextBlock> HintTextBlock;
	TSharedPtr<SBorder> MarketPanel;
	TSharedPtr<SVerticalBox> SosBox;
	TSharedPtr<SBorder> SosPanel;
	TSharedPtr<SSpaceSystemMiniMapCanvas> MiniMapCanvas;
};
